// services/maximoService.js
const { query, queryOne } = require("../db/pool");
const maximoClient = require("./maximoClient");

// Get configuration from environment
const MAXIMO_SITE_ID = process.env.MAXIMO_SITE_ID || "BEDFORD";
const AUTO_CREATE_ASSETS = process.env.MAXIMO_AUTO_CREATE_ASSETS === 'true';

// Asset mapping cache
let assetMappingCache = null;
let lastMappingFetch = 0;
const CACHE_TTL = 60000; // 1 minute

/**
 * Generate a unique ID without using uuid
 */
function generateUniqueId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}

/**
 * Get asset mapping from database with caching.
 *
 * BUGFIX: this used to query `maximo_asset_mappings`, a table that is never
 * created by any script in sql/ — every call silently failed (caught below)
 * and returned {}, which meant resolveMaximoAssetnum() never found a match
 * and every work order was pushed with the local AST-00x ID as `assetnum`,
 * regardless of what an admin configured in `maximo_assets.assetnum` per the
 * README instructions. `maximo_assets` (sql/schema_extension.sql) IS the
 * real, already-seeded mapping table — this now reads from it directly.
 */
async function getAssetMapping() {
    const now = Date.now();
    if (assetMappingCache && (now - lastMappingFetch) < CACHE_TTL) {
        return assetMappingCache;
    }

    try {
        const mapping = await query(
            `SELECT asset_id AS localAssetId, assetnum AS maximoAssetNum, siteid AS siteId
             FROM maximo_assets`
        );

        const mappingObj = {};
        mapping.forEach(row => {
            mappingObj[row.localAssetId] = {
                maximoAssetNum: row.maximoAssetNum,
                siteId: row.siteId || 'BEDFORD'
            };
        });

        assetMappingCache = mappingObj;
        lastMappingFetch = now;
        return mappingObj;
    } catch (error) {
        console.error('[maximoService] Failed to fetch asset mapping:', error);
        return {};
    }
}

/**
 * Save asset mapping to database (upsert into maximo_assets — see getAssetMapping
 * bugfix note above; this used to write to the nonexistent maximo_asset_mappings).
 */
async function saveAssetMapping(localAssetId, maximoAssetNum, siteId = 'BEDFORD') {
    try {
        const existing = await queryOne(
            `SELECT id FROM maximo_assets WHERE asset_id = @localAssetId`,
            { localAssetId }
        );

        if (existing) {
            await query(
                `UPDATE maximo_assets 
                 SET assetnum = @maximoAssetNum, 
                     siteid = @siteId,
                     last_synced_at = GETUTCDATE()
                 WHERE asset_id = @localAssetId`,
                { localAssetId, maximoAssetNum, siteId }
            );
        } else {
            await query(
                `INSERT INTO maximo_assets 
                 (asset_id, assetnum, siteid, status, last_synced_at)
                 VALUES (@localAssetId, @maximoAssetNum, @siteId, 'OPERATING', GETUTCDATE())`,
                { localAssetId, maximoAssetNum, siteId }
            );
        }

        assetMappingCache = null;
        return true;
    } catch (error) {
        console.error('[maximoService] Failed to save asset mapping:', error);
        return false;
    }
}

/**
 * Resolve Maximo asset number from local asset ID
 */
async function resolveMaximoAssetnum(assetId) {
    if (!assetId) return null;

    const cleanId = String(assetId).trim();
    
    const mapping = await getAssetMapping();
    if (mapping[cleanId]) {
        return mapping[cleanId].maximoAssetNum;
    }

    if (maximoClient.isConfigured()) {
        try {
            const maximoAsset = await findAssetInMaximo(cleanId);
            if (maximoAsset) {
                await saveAssetMapping(cleanId, maximoAsset.assetnum, maximoAsset.siteid);
                return maximoAsset.assetnum;
            }
        } catch (error) {
            console.error(`[maximoService] Failed to find asset ${cleanId} in Maximo:`, error.message);
        }
    }

    console.warn(`[maximoService] No maximo_assets mapping for ${cleanId} — sending local ID as assetnum, Maximo will likely reject it.`);
    return cleanId;
}

/**
 * Try to find asset in Maximo
 */
async function findAssetInMaximo(localId) {
    try {
        const response = await maximoClient.request(
            `/oslc/os/mxasset?oslc.where=assetnum="${localId}" and siteid="${MAXIMO_SITE_ID}"&lean=1`
        );

        if (response && response['oslc:results'] && response['oslc:results'].length > 0) {
            const asset = response['oslc:results'][0];
            return {
                assetnum: asset.assetnum,
                siteid: asset.siteid || MAXIMO_SITE_ID
            };
        }

        const response2 = await maximoClient.request(
            `/oslc/os/mxasset?oslc.where=description contains "${localId}"&lean=1`
        );

        if (response2 && response2['oslc:results'] && response2['oslc:results'].length > 0) {
            const asset = response2['oslc:results'][0];
            return {
                assetnum: asset.assetnum,
                siteid: asset.siteid || MAXIMO_SITE_ID
            };
        }

        return null;
    } catch (error) {
        console.error(`[maximoService] Error finding asset ${localId}:`, error.message);
        return null;
    }
}

/**
 * Create a placeholder asset in Maximo
 */
async function createPlaceholderAsset(localAssetId) {
    if (!AUTO_CREATE_ASSETS) {
        console.log(`[maximoService] Auto-creation of assets disabled. Skipping placeholder for ${localAssetId}`);
        return null;
    }

    try {
        const genericAssets = await findGenericAssets();
        if (genericAssets && genericAssets.length > 0) {
            const asset = genericAssets[0];
            console.log(`[maximoService] Using existing generic asset ${asset.assetnum} for ${localAssetId}`);
            await saveAssetMapping(localAssetId, asset.assetnum, asset.siteid || MAXIMO_SITE_ID);
            return asset.assetnum;
        }

        const newAssetNum = `ASSET-${generateUniqueId().toUpperCase()}`;
        const payload = {
            assetnum: newAssetNum,
            description: `Auto-created placeholder for local asset ${localAssetId}`,
            siteid: MAXIMO_SITE_ID,
            status: 'OPERATING'
        };

        console.log('[maximoService] Creating placeholder asset in Maximo:', payload);
        
        const response = await maximoClient.request('/oslc/os/mxasset?lean=1', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (response && response.assetnum) {
            console.log(`[maximoService] Successfully created placeholder asset ${response.assetnum}`);
            await saveAssetMapping(localAssetId, response.assetnum, MAXIMO_SITE_ID);
            return response.assetnum;
        }

        console.warn(`[maximoService] Failed to create placeholder asset, using fallback asset number`);
        const fallbackAsset = process.env.MAXIMO_FALLBACK_ASSET || 'ASSET-0001';
        await saveAssetMapping(localAssetId, fallbackAsset, MAXIMO_SITE_ID);
        return fallbackAsset;

    } catch (error) {
        console.error('[maximoService] Failed to create placeholder asset:', error.message);
        const fallbackAsset = process.env.MAXIMO_FALLBACK_ASSET || null;
        if (fallbackAsset) {
            console.log(`[maximoService] Using fallback asset ${fallbackAsset}`);
            await saveAssetMapping(localAssetId, fallbackAsset, MAXIMO_SITE_ID);
            return fallbackAsset;
        }
        return null;
    }
}

/**
 * Find generic assets in Maximo
 */
async function findGenericAssets() {
    try {
        const response = await maximoClient.request(
            `/oslc/os/mxasset?oslc.where=assetnum contains "GEN" or description contains "Generic" or description contains "Placeholder"&lean=1`
        );

        if (response && response['oslc:results']) {
            return response['oslc:results'];
        }
        return [];
    } catch (error) {
        console.error('[maximoService] Failed to find generic assets:', error.message);
        return [];
    }
}

/**
 * Helper function to ensure a local asset row AND its Maximo mapping row exist.
 *
 * BUGFIX: this used to `INSERT INTO assets (asset_id, assetnum, description,
 * siteid, ...)` — none of those columns exist on `assets` (its real schema is
 * `id, name, type, location, install_date, created_at`; assetnum/siteid live
 * on `maximo_assets`, keyed by `asset_id`). The insert always threw and was
 * silently swallowed by the catch below, so this safety-net never actually
 * ran. It now writes to the correct table/columns for each half of the model.
 */
async function ensureAssetExists(assetId, assetnum) {
    try {
        const existingAsset = await queryOne(
            `SELECT id FROM assets WHERE id = @assetId`,
            { assetId }
        );

        if (!existingAsset) {
            await query(
                `INSERT INTO assets (id, name, type, location, install_date, created_at)
                 VALUES (@assetId, @name, @type, @location, GETUTCDATE(), GETUTCDATE())`,
                {
                    assetId,
                    name: `Auto-registered asset ${assetId}`,
                    type: 'UNKNOWN',
                    location: 'UNASSIGNED',
                }
            );
            console.log(`Created new asset in local DB: ${assetId}`);
        }

        const existingMapping = await queryOne(
            `SELECT id FROM maximo_assets WHERE asset_id = @assetId`,
            { assetId }
        );
        if (!existingMapping) {
            await query(
                `INSERT INTO maximo_assets (asset_id, assetnum, siteid, status, description)
                 VALUES (@assetId, @assetnum, @siteid, 'OPERATING', @description)`,
                {
                    assetId,
                    assetnum: assetnum || assetId,
                    siteid: MAXIMO_SITE_ID,
                    description: `Auto-registered mapping for ${assetId}`,
                }
            );
            console.log(`Created new maximo_assets mapping: ${assetId} -> ${assetnum || assetId}`);
        }
    } catch (error) {
        console.error('[maximoService] ensureAssetExists failed:', error.message);
    }
}

async function listWorkOrders(status) {
    if (status) {
        return query(
            `SELECT wo.id, wo.wonum, wo.asset_id AS assetId, a.name AS assetName, wo.assetnum, wo.siteid,
                    wo.description, wo.worktype, wo.priority, wo.status, wo.generate_type AS generateType,
                    wo.reported_by AS reportedBy, wo.created_at AS createdAt, wo.updated_at AS updatedAt
             FROM maximo_workorders wo
             LEFT JOIN assets a ON a.id = wo.asset_id
             WHERE wo.status = @status ORDER BY wo.created_at DESC`,
            { status }
        );
    }
    return query(
        `SELECT wo.id, wo.wonum, wo.asset_id AS assetId, a.name AS assetName, wo.assetnum, wo.siteid,
                wo.description, wo.worktype, wo.priority, wo.status, wo.generate_type AS generateType,
                wo.reported_by AS reportedBy, wo.created_at AS createdAt, wo.updated_at AS updatedAt
         FROM maximo_workorders wo
         LEFT JOIN assets a ON a.id = wo.asset_id
         ORDER BY wo.created_at DESC`
    );
}

async function getWorkOrder(wonum) {
    return queryOne(
        `SELECT wo.id, wo.wonum, wo.asset_id AS assetId, a.name AS assetName, wo.assetnum, wo.siteid,
                wo.description, wo.worktype, wo.priority, wo.status, wo.generate_type AS generateType,
                wo.reported_by AS reportedBy, wo.mif_payload AS payload,
                wo.created_at AS createdAt, wo.updated_at AS updatedAt
         FROM maximo_workorders wo
         LEFT JOIN assets a ON a.id = wo.asset_id
         WHERE wo.wonum = @wonum`,
        { wonum }
    );
}

async function createLocalWorkOrder({ assetId, description, priority, createdBy, siteId, generateType }) {
    const wonum = `WO-${Date.now()}`;
    const woGenerateType = generateType || "MANUAL";

    try {
        await ensureAssetExists(assetId, assetId);
    } catch (e) {
        console.log('Assets table may not exist, continuing...');
    }

    const maximoSiteId = siteId || MAXIMO_SITE_ID;
    let resolvedAssetnum = await resolveMaximoAssetnum(assetId);
    
    if (resolvedAssetnum === assetId && AUTO_CREATE_ASSETS) {
        console.log(`[maximoService] No valid Maximo asset for ${assetId}, attempting to create placeholder...`);
        const placeholder = await createPlaceholderAsset(assetId);
        if (placeholder) {
            resolvedAssetnum = placeholder;
        }
    }

    // Map priority to Maximo scale (1-5, 1 = Critical)
    let mappedPriority = priority || 2;
    mappedPriority = Math.min(Math.max(parseInt(mappedPriority) || 2, 1), 5);

    // Map generate type to origin
    let generateTypeForMaximo = woGenerateType;
    if (woGenerateType === 'AUTO_CRITICAL_ALERT') {
        generateTypeForMaximo = 'AUTO-CRITICAL';
    } else if (woGenerateType === 'AUTO_ML_PREDICTION') {
        generateTypeForMaximo = 'AUTO-ML';
    }

    // Set initial status based on generate type
    let initialStatus = 'WAPPR'; // Waiting Approval by default
    if (woGenerateType === 'MANUAL') {
        initialStatus = 'APPR'; // Manual work orders start as Approved
    }

    const payload = {
        wonum,
        assetnum: resolvedAssetnum,
        siteid: maximoSiteId,
        description: description || `Work order for asset ${assetId}`,
        worktype: "CM",
        priority: mappedPriority,
        wopriority: mappedPriority,
        status: initialStatus,
        reportedby: createdBy || "SYSTEM",
    };

    console.log('Creating work order with payload:', payload);

    try {
        // Insert into local database with proper priority mapping
        await query(
            `INSERT INTO maximo_workorders 
             (wonum, asset_id, assetnum, siteid, description, worktype, priority, status, reported_by, generate_type, mif_payload)
             VALUES (@wonum, @assetId, @assetnum, @siteid, @description, @worktype, @priority, @status, @reportedBy, @generateType, @payload)`,
            {
                wonum, 
                assetId, 
                assetnum: resolvedAssetnum,
                siteid: maximoSiteId,
                description: description || `Work order for asset ${assetId}`,
                worktype: "CM", 
                priority: mappedPriority, 
                status: initialStatus,
                reportedBy: createdBy || "SYSTEM",
                generateType: woGenerateType,
                payload: JSON.stringify(payload),
            }
        );

        const workOrder = await getWorkOrder(wonum);

        // Create sync log entry
        await query(
            `INSERT INTO maximo_sync_log 
             (entity_type, entity_local_id, direction, sync_status, endpoint, request_payload)
             SELECT 'WORKORDER', id, 'OUTBOUND', 'PENDING', '/oslc/os/mxapiwo', mif_payload
             FROM maximo_workorders WHERE wonum = @wonum`,
            { wonum }
        );

        let maximoResponse = null;
        if (maximoClient.isConfigured()) {
            try {
                console.log(`Attempting to push work order ${wonum} to Maximo...`);
                maximoResponse = await pushWorkOrderToMaximo(wonum, payload);
                console.log(`Work order ${wonum} pushed to Maximo successfully`);
            } catch (error) {
                console.error(`Failed to push work order ${wonum} to Maximo:`, error.message);
                const logRow = await queryOne(
                    `SELECT TOP 1 id FROM maximo_sync_log
                     WHERE entity_type = 'WORKORDER' AND sync_status = 'PENDING'
                       AND entity_local_id = (SELECT id FROM maximo_workorders WHERE wonum = @wonum)
                     ORDER BY attempted_at DESC`,
                    { wonum }
                );
                if (logRow) {
                    await updateSyncStatus(logRow.id, "FAILED", error.body || null, error.message);
                }
            }
        }

        return { ...workOrder, maximo_response: maximoResponse };
    } catch (error) {
        console.error('Error creating work order:', error);
        throw error;
    }
}

async function pushWorkOrderToMaximo(wonum, payload) {
    const logRow = await queryOne(
        `SELECT TOP 1 id FROM maximo_sync_log
         WHERE entity_type = 'WORKORDER' AND sync_status = 'PENDING'
           AND entity_local_id = (SELECT id FROM maximo_workorders WHERE wonum = @wonum)
         ORDER BY attempted_at DESC`,
        { wonum }
    );

    // Map priority properly (1 = Critical, 5 = Low)
    let priority = payload.priority || 2;
    priority = Math.min(Math.max(parseInt(priority) || 2, 1), 5);

    // Map status properly for Maximo
    let status = payload.status || 'WAPPR';
    // Maximo valid statuses: WAPPR, APPR, INPRG, WMATL, COMP, CLOSE, CAN
    const validStatuses = ['WAPPR', 'APPR', 'INPRG', 'WMATL', 'COMP', 'CLOSE', 'CAN'];
    if (!validStatuses.includes(status)) {
        status = 'WAPPR';
    }

    const outboundPayload = { 
        wonum: payload.wonum,
        assetnum: payload.assetnum,
        siteid: MAXIMO_SITE_ID,
        description: payload.description || `Work order for asset ${payload.assetnum}`,
        worktype: payload.worktype || "CM",
        priority: priority,
        wopriority: priority,
        status: status,
        reportedby: payload.reportedby || "SYSTEM"
    };

    try {
        console.log('Sending to Maximo with payload:', outboundPayload);
        const response = await maximoClient.createWorkOrder(outboundPayload);
        console.log('Maximo response:', response);
        
        if (logRow) {
            await updateSyncStatus(logRow.id, "SENT", response, null);
        }
        return response;
    } catch (error) {
        console.error('Error pushing to Maximo:', error.message);
        if (error.body) {
            console.error('Maximo error details:', JSON.stringify(error.body, null, 2));
        }
        if (logRow) {
            await updateSyncStatus(logRow.id, "FAILED", error.body || null, error.message);
        }
        throw error;
    }
}

async function updateWorkOrderStatus(wonum, status) {
    const workOrder = await queryOne(`SELECT id, siteid FROM maximo_workorders WHERE wonum=@wonum`, { wonum });
    if (!workOrder) return null;
    await query(`UPDATE maximo_workorders SET status=@status, updated_at=GETUTCDATE() WHERE wonum=@wonum`, { wonum, status });

    if (maximoClient.isConfigured()) {
        const logResult = await query(
            `INSERT INTO maximo_sync_log (entity_type, entity_local_id, direction, sync_status, endpoint, request_payload)
             OUTPUT INSERTED.id AS id
             VALUES ('WORKORDER', @entityLocalId, 'OUTBOUND', 'PENDING', '/oslc/os/mxapiwo', @payload)`,
            { entityLocalId: workOrder.id, payload: JSON.stringify({ wonum, status }) }
        );
        const logId = logResult[0]?.id;
        try {
            const response = await maximoClient.updateWorkOrderStatus(wonum, workOrder.siteid || MAXIMO_SITE_ID, status);
            if (logId) await updateSyncStatus(logId, "SENT", response, null);
        } catch (error) {
            console.error(`[maximoService] Failed to push status update for ${wonum}:`, error.message);
            if (logId) await updateSyncStatus(logId, "FAILED", error.body || null, error.message);
        }
    }

    return getWorkOrder(wonum);
}

async function listPendingSyncs() {
    return query(
        `SELECT sl.id, sl.entity_type AS entityType, sl.entity_local_id AS entityLocalId, sl.direction,
                sl.sync_status AS syncStatus, sl.endpoint, sl.request_payload AS requestPayload, sl.attempted_at AS attemptedAt,
                wo.asset_id AS assetId
         FROM maximo_sync_log sl
         LEFT JOIN maximo_workorders wo ON wo.id = sl.entity_local_id AND sl.entity_type = 'WORKORDER'
         WHERE sl.sync_status IN ('PENDING', 'FAILED') ORDER BY sl.attempted_at ASC`
    );
}

async function listRecentSyncs(limit) {
    return query(
        `SELECT TOP (@limit) sl.id, sl.entity_type AS entityType, sl.entity_local_id AS entityLocalId, sl.direction,
                sl.sync_status AS syncStatus, sl.endpoint, sl.error_message AS errorMessage,
                sl.request_payload AS requestPayload, sl.response_payload AS responsePayload,
                sl.attempted_at AS attemptedAt, sl.completed_at AS completedAt,
                wo.wonum, wo.priority, wo.status AS wonumStatus, wo.assetnum, wo.asset_id AS assetId,
                wo.created_at AS wonumCreatedAt
         FROM maximo_sync_log sl
         LEFT JOIN maximo_workorders wo ON wo.id = sl.entity_local_id AND sl.entity_type = 'WORKORDER'
         ORDER BY sl.attempted_at DESC`,
        { limit: limit || 100 }
    );
}

async function updateSyncStatus(logId, syncStatus, responsePayload, errorMessage) {
    await query(
        `UPDATE maximo_sync_log SET sync_status=@syncStatus, response_payload=@responsePayload,
                error_message=@errorMessage, completed_at=GETUTCDATE() WHERE id=@logId`,
        {
            logId, syncStatus,
            responsePayload: responsePayload ? JSON.stringify(responsePayload) : null,
            errorMessage: errorMessage || null,
        }
    );
}

async function retrySingleSync(logId) {
    if (!maximoClient.isConfigured()) {
        return { attempted: 0, sent: 0, failed: 0, error: "Maximo not configured" };
    }

    const row = await queryOne(
        `SELECT sl.id, sl.entity_type AS entityType, sl.request_payload AS requestPayload,
                wo.asset_id AS assetId
         FROM maximo_sync_log sl
         LEFT JOIN maximo_workorders wo ON wo.id = sl.entity_local_id
         WHERE sl.id = @logId`,
        { logId }
    );
    if (!row || row.entityType !== "WORKORDER") {
        return { attempted: 0, sent: 0, failed: 0, error: "Sync log entry not found" };
    }

    try {
        const payload = JSON.parse(row.requestPayload);
        let currentAssetnum = row.assetId ? await resolveMaximoAssetnum(row.assetId) : payload.assetnum;
        
        if (currentAssetnum === row.assetId && AUTO_CREATE_ASSETS) {
            const placeholder = await createPlaceholderAsset(row.assetId);
            if (placeholder) {
                currentAssetnum = placeholder;
            }
        }

        const outboundPayload = {
            wonum: payload.wonum,
            assetnum: currentAssetnum,
            siteid: MAXIMO_SITE_ID,
            description: payload.description,
            worktype: payload.worktype || "CM",
            priority: payload.priority || 2,
            wopriority: payload.priority || 2,
            status: payload.status || "APPR",
            reportedby: payload.reportedby || "SYSTEM",
        };
        const response = await maximoClient.createWorkOrder(outboundPayload);
        await updateSyncStatus(row.id, "SENT", response, null);
        return { attempted: 1, sent: 1, failed: 0 };
    } catch (error) {
        await updateSyncStatus(row.id, "FAILED", error.body || null, error.message);
        return { attempted: 1, sent: 0, failed: 1, error: error.message };
    }
}

// ── Reverse sync: Maximo -> local dashboard ─────────────────────────────
const TERMINAL_STATUSES = ["COMP", "CLOSE", "CAN"];

function extractStatusFromMaximoResponse(response, wonumForLog) {
    if (!response) return null;

    let record = null;
    
    // Try different response shapes
    if (Array.isArray(response) && response.length) {
        record = response[0];
    } else if (response.rdf && response.rdf.Description) {
        record = Array.isArray(response.rdf.Description) ? response.rdf.Description[0] : response.rdf.Description;
    } else if (response.member && response.member.length) {
        record = response.member[0];
    } else if (response['oslc:results'] && response['oslc:results'].length) {
        record = response['oslc:results'][0];
    } else if (typeof response === "object") {
        record = response;
    }

    if (!record) {
        console.log(`[pullStatusUpdates] Unrecognized Maximo response shape for ${wonumForLog}:`, 
            JSON.stringify(response).slice(0, 500));
        return null;
    }

    // Try to find status in various places
    const statusKeys = ["status", "spi:status", "wostatus", "STATUS", "Status", "wostatus", "workorderstatus"];
    for (const key of statusKeys) {
        const raw = record[key];
        if (raw === undefined || raw === null) continue;
        const value = typeof raw === "object" ? (raw["$"] ?? raw.value ?? null) : raw;
        if (value) return value;
    }

    // Try to find status in the href
    if (record.href) {
        const hrefMatch = record.href.match(/status=([^&]+)/);
        if (hrefMatch) {
            return hrefMatch[1];
        }
    }

    console.log(`[pullStatusUpdates] No status field found on record for ${wonumForLog}. Record keys:`, Object.keys(record));
    return null;
}

async function pullStatusUpdates() {
    if (!maximoClient.isConfigured()) {
        return { checked: 0, updated: 0, error: "Maximo not configured" };
    }

    // Get all work orders that are not terminal
    const openWorkOrders = await query(
        `SELECT wo.id, wo.wonum, wo.siteid, wo.status AS localStatus,
                wo.asset_id, wo.assetnum, 
                (SELECT TOP 1 sync_status FROM maximo_sync_log 
                 WHERE entity_local_id = wo.id 
                 AND entity_type = 'WORKORDER' 
                 ORDER BY attempted_at DESC) AS lastSyncStatus
         FROM maximo_workorders wo
         WHERE wo.status NOT IN ('COMP', 'CLOSE', 'CAN')`
    );

    console.log(`[pullStatusUpdates] Checking ${openWorkOrders.length} work orders for status updates`);

    let updated = 0;
    let notFound = 0;
    let found = 0;
    const changes = [];
    const notFoundList = [];

    for (const wo of openWorkOrders) {
        try {
            // Try multiple approaches to find the work order in Maximo
            let response = null;
            let foundIt = false;
            
            // Approach 1: Try with wonum and site
            try {
                response = await maximoClient.getWorkOrder(wo.wonum, wo.siteid || MAXIMO_SITE_ID);
                if (response) {
                    foundIt = true;
                    console.log(`[pullStatusUpdates] Found ${wo.wonum} by wonum+site`);
                }
            } catch (error) {
                if (error.status === 404) {
                    console.log(`[pullStatusUpdates] ${wo.wonum} not found by wonum+site (404)`);
                } else {
                    throw error;
                }
            }

            // Approach 2: If not found, try searching by description
            if (!foundIt) {
                try {
                    const searchResponse = await maximoClient.request(
                        `/oslc/os/mxapiwo?oslc.where=description contains "${wo.wonum}"&lean=1`
                    );
                    if (searchResponse && searchResponse.member && searchResponse.member.length > 0) {
                        const href = searchResponse.member[0].href;
                        if (href) {
                            const pathMatch = href.match(/\/oslc\/os\/mxapiwo\/[^?]+/);
                            if (pathMatch) {
                                response = await maximoClient.request(`${pathMatch[0]}?lean=0`);
                                if (response) {
                                    foundIt = true;
                                    console.log(`[pullStatusUpdates] Found ${wo.wonum} by description`);
                                }
                            }
                        }
                    }
                } catch (error) {
                    console.log(`[pullStatusUpdates] ${wo.wonum} not found by description`);
                }
            }

            // Approach 3: If still not found, try searching without site
            if (!foundIt) {
                try {
                    const searchResponse = await maximoClient.request(
                        `/oslc/os/mxapiwo?oslc.where=wonum="${wo.wonum}"&lean=1`
                    );
                    if (searchResponse && searchResponse.member && searchResponse.member.length > 0) {
                        const href = searchResponse.member[0].href;
                        if (href) {
                            const pathMatch = href.match(/\/oslc\/os\/mxapiwo\/[^?]+/);
                            if (pathMatch) {
                                response = await maximoClient.request(`${pathMatch[0]}?lean=0`);
                                if (response) {
                                    foundIt = true;
                                    console.log(`[pullStatusUpdates] Found ${wo.wonum} without site filter`);
                                }
                            }
                        }
                    }
                } catch (error) {
                    console.log(`[pullStatusUpdates] ${wo.wonum} not found without site`);
                }
            }

            if (!foundIt || !response) {
                console.log(`[pullStatusUpdates] ${wo.wonum} not found in Maximo after all attempts`);
                notFound++;
                notFoundList.push(wo.wonum);
                
                if (!wo.lastSyncStatus || wo.lastSyncStatus === 'PENDING') {
                    console.log(`[pullStatusUpdates] ${wo.wonum} was never synced to Maximo - local only`);
                }
                continue;
            }

            found++;
            
            // Extract status from the response
            const maximoStatus = extractStatusFromMaximoResponse(response, wo.wonum);

            if (maximoStatus && maximoStatus !== wo.localStatus) {
                console.log(`[pullStatusUpdates] Status change detected for ${wo.wonum}: ${wo.localStatus} -> ${maximoStatus}`);
                
                await query(
                    `UPDATE maximo_workorders SET status = @status, updated_at = GETUTCDATE() WHERE id = @id`,
                    { id: wo.id, status: maximoStatus }
                );
                updated += 1;
                changes.push({ 
                    id: wo.id, 
                    wonum: wo.wonum, 
                    from: wo.localStatus, 
                    to: maximoStatus 
                });

                // Emit socket event for real-time update
                const io = global.io;
                if (io) {
                    io.emit("workorder:updated", { 
                        id: wo.id, 
                        wonum: wo.wonum, 
                        status: maximoStatus,
                        oldStatus: wo.localStatus 
                    });
                }
            } else if (maximoStatus) {
                console.log(`[pullStatusUpdates] ${wo.wonum}: Status unchanged (${maximoStatus})`);
            }
        } catch (error) {
            console.error(`[pullStatusUpdates] Failed to pull status for ${wo.wonum}:`, error.message);
        }
    }

    console.log(`[pullStatusUpdates] Summary: Found ${found}, Not found ${notFound}, Updated ${updated}`);
    if (notFoundList.length > 0) {
        console.log(`[pullStatusUpdates] Not found in Maximo: ${notFoundList.join(', ')}`);
    }

    return { 
        checked: openWorkOrders.length, 
        found,
        notFound,
        notFoundList,
        updated, 
        changes,
        message: updated > 0 ? `Updated ${updated} work orders` : 'No changes detected'
    };
}

/**
 * Find a work order in Maximo using multiple search approaches
 */
async function findWorkOrderInMaximo(wonum) {
    console.log(`[findWorkOrderInMaximo] Searching for ${wonum}...`);
    
    try {
        // Try different search approaches
        const approaches = [
            { method: 'by wonum with site', query: `oslc.where=wonum="${wonum}" and siteid="${MAXIMO_SITE_ID}"` },
            { method: 'by wonum without site', query: `oslc.where=wonum="${wonum}"` },
            { method: 'by description containing wonum', query: `oslc.where=description contains "${wonum}"` },
            { method: 'by description exact', query: `oslc.where=description="${wonum}"` },
        ];

        for (const approach of approaches) {
            try {
                console.log(`[findWorkOrderInMaximo] Trying: ${approach.method}`);
                const response = await maximoClient.request(`/oslc/os/mxapiwo?${approach.query}&lean=1`);
                
                if (response && response.member && response.member.length > 0) {
                    // Get full details
                    const href = response.member[0].href;
                    if (href) {
                        const pathMatch = href.match(/\/oslc\/os\/mxapiwo\/[^?]+/);
                        if (pathMatch) {
                            const fullResponse = await maximoClient.request(`${pathMatch[0]}?lean=0`);
                            console.log(`[findWorkOrderInMaximo] Found with ${approach.method}:`);
                            console.log(JSON.stringify(fullResponse, null, 2));
                            return fullResponse;
                        }
                    }
                }
            } catch (error) {
                console.log(`[findWorkOrderInMaximo] ${approach.method} failed:`, error.message);
            }
        }
        
        console.log(`[findWorkOrderInMaximo] Work order ${wonum} not found in Maximo`);
        return null;
    } catch (error) {
        console.error(`[findWorkOrderInMaximo] Error:`, error);
        return null;
    }
}

/**
 * Pull the latest status/description from Maximo for every asset we already
 * have mapped locally (maximo_assets.assetnum), keeping local state in sync
 * with Maximo's asset register.
 *
 * BUGFIX: previously wrote to the nonexistent `maximo_asset_mappings` table
 * (see notes above) and, worse, treated every asset Maximo returned as a new
 * local asset keyed by its own assetnum — which would have flooded the local
 * `assets`/`maximo_assets` tables with unrelated Maximo assets instead of
 * updating the 5 real monitored assets (AST-001..005) this project tracks.
 * This now only ever updates rows that are already mapped locally; an asset
 * present in Maximo but not yet mapped to one of our assets is reported as
 * `unmatched`, not silently fabricated.
 */
async function syncAssetsFromMaximo() {
    if (!maximoClient.isConfigured()) {
        return { error: "Maximo not configured" };
    }

    try {
        console.log('[maximoService] Syncing assets from Maximo...');
        const maximoAssets = await maximoClient.fetchAssets(500);

        if (!maximoAssets || maximoAssets.length === 0) {
            return { total: 0, updated: 0, unmatched: 0, message: "No assets found in Maximo" };
        }

        const localMappings = await query(`SELECT asset_id AS assetId, assetnum FROM maximo_assets`);
        const byAssetnum = new Map(localMappings.map(m => [m.assetnum, m.assetId]));

        let updated = 0;
        let unmatched = 0;

        for (const asset of maximoAssets) {
            if (!asset.assetnum) continue;
            const localAssetId = byAssetnum.get(asset.assetnum);

            if (!localAssetId) {
                unmatched++;
                continue;
            }

            try {
                await query(
                    `UPDATE maximo_assets
                     SET siteid = @siteid, status = @status, description = @description,
                         last_synced_at = GETUTCDATE()
                     WHERE asset_id = @assetId`,
                    {
                        assetId: localAssetId,
                        siteid: asset.siteid || MAXIMO_SITE_ID,
                        status: asset.status || 'OPERATING',
                        description: asset.description || '',
                    }
                );
                updated++;
            } catch (error) {
                console.error(`[maximoService] Failed to sync asset ${asset.assetnum}:`, error.message);
            }
        }

        assetMappingCache = null;

        return {
            total: maximoAssets.length,
            updated,
            unmatched,
            message: `Refreshed ${updated} mapped asset(s) from Maximo; ${unmatched} Maximo asset(s) had no local mapping and were left untouched.`,
        };
    } catch (error) {
        console.error('[maximoService] Failed to sync assets:', error);
        return { error: error.message };
    }
}

/**
 * Get work order metrics for dashboard
 */
async function getWorkOrderMetrics() {
    try {
        const metrics = await queryOne(
            `SELECT 
                COUNT(*) as total,
                SUM(CASE WHEN status = 'WAPPR' THEN 1 ELSE 0 END) as waiting_approval,
                SUM(CASE WHEN status = 'APPR' THEN 1 ELSE 0 END) as approved,
                SUM(CASE WHEN status = 'INPRG' THEN 1 ELSE 0 END) as in_progress,
                SUM(CASE WHEN status = 'WMATL' THEN 1 ELSE 0 END) as waiting_material,
                SUM(CASE WHEN status = 'COMP' THEN 1 ELSE 0 END) as complete,
                SUM(CASE WHEN status = 'CLOSE' THEN 1 ELSE 0 END) as closed,
                SUM(CASE WHEN status = 'CAN' THEN 1 ELSE 0 END) as cancelled,
                AVG(DATEDIFF(HOUR, created_at, GETUTCDATE())) as avg_hours_open,
                MAX(DATEDIFF(HOUR, created_at, GETUTCDATE())) as max_hours_open
             FROM maximo_workorders
             WHERE created_at > DATEADD(DAY, -30, GETUTCDATE())`
        );
        return metrics || { total: 0 };
    } catch (error) {
        console.error('[maximoService] Failed to get work order metrics:', error);
        return { total: 0 };
    }
}

async function retryPendingSyncs() {
    if (!maximoClient.isConfigured()) {
        return { attempted: 0, sent: 0, failed: 0, error: 'Maximo not configured' };
    }

    const pending = await listPendingSyncs();
    let sent = 0;
    let failed = 0;

    for (const row of pending) {
        if (row.entityType !== "WORKORDER") continue;
        try {
            const payload = JSON.parse(row.requestPayload);
            let currentAssetnum = row.assetId ? await resolveMaximoAssetnum(row.assetId) : payload.assetnum;
            
            if (currentAssetnum === row.assetId && AUTO_CREATE_ASSETS) {
                const placeholder = await createPlaceholderAsset(row.assetId);
                if (placeholder) {
                    currentAssetnum = placeholder;
                }
            }

            const outboundPayload = { 
                wonum: payload.wonum,
                assetnum: currentAssetnum,
                siteid: MAXIMO_SITE_ID,
                description: payload.description,
                worktype: payload.worktype || "CM",
                priority: payload.priority || 2,
                wopriority: payload.priority || 2,
                status: payload.status || "APPR",
                reportedby: payload.reportedby || "SYSTEM"
            };
            
            console.log(`Retrying sync for ${payload.wonum}...`);
            const response = await maximoClient.createWorkOrder(outboundPayload);
            await updateSyncStatus(row.id, "SENT", response, null);
            sent += 1;
            console.log(`Successfully synced ${payload.wonum}`);
        } catch (error) {
            console.error(`Failed to sync work order:`, error.message);
            if (error.body) {
                console.error('Maximo error details:', JSON.stringify(error.body, null, 2));
            }
            await updateSyncStatus(row.id, "FAILED", error.body || null, error.message);
            failed += 1;
        }
    }

    return { attempted: pending.length, sent, failed };
}

/**
 * Force refresh status for a specific work order
 */
async function refreshWorkOrderStatus(wonum) {
    if (!maximoClient.isConfigured()) {
        return { error: "Maximo not configured" };
    }

    try {
        const workOrder = await queryOne(
            `SELECT id, wonum, siteid, status FROM maximo_workorders WHERE wonum = @wonum`,
            { wonum }
        );

        if (!workOrder) {
            return { error: "Work order not found" };
        }

        const response = await maximoClient.getWorkOrder(wonum, workOrder.siteid || MAXIMO_SITE_ID);
        const maximoStatus = extractStatusFromMaximoResponse(response, wonum);

        if (maximoStatus && maximoStatus !== workOrder.status) {
            await query(
                `UPDATE maximo_workorders SET status = @status, updated_at = GETUTCDATE() WHERE wonum = @wonum`,
                { wonum, status: maximoStatus }
            );
            
            return {
                success: true,
                wonum,
                oldStatus: workOrder.status,
                newStatus: maximoStatus,
                updated: true
            };
        }

        return {
            success: true,
            wonum,
            currentStatus: workOrder.status,
            updated: false,
            message: 'Status unchanged'
        };
    } catch (error) {
        console.error(`[maximoService] Failed to refresh status for ${wonum}:`, error.message);
        return { error: error.message };
    }
}

module.exports = {
    listWorkOrders,
    getWorkOrder,
    createLocalWorkOrder,
    updateWorkOrderStatus,
    listPendingSyncs,
    listRecentSyncs,
    updateSyncStatus,
    pushWorkOrderToMaximo,
    pullStatusUpdates,
    retryPendingSyncs,
    retrySingleSync,
    refreshWorkOrderStatus,
    findWorkOrderInMaximo,
    syncAssetsFromMaximo,
    getWorkOrderMetrics,
    isMaximoConfigured: maximoClient.isConfigured,
    resolveMaximoAssetnum,
    saveAssetMapping,
    findAssetInMaximo,
    createPlaceholderAsset,
    getAssetMapping
};