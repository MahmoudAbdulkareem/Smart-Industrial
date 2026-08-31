// services/maximoClient.js
const fetchModule = (...args) => import("node-fetch").then(({ default: fetch }) => fetch(...args));

const MAXIMO_BASE_URL = process.env.MAXIMO_BASE_URL || "";
const MAXIMO_API_KEY = process.env.MAXIMO_API_KEY || "";
const MAXIMO_TIMEOUT_MS = parseInt(process.env.MAXIMO_TIMEOUT_MS || "8000");

function isConfigured() {
    return Boolean(MAXIMO_BASE_URL && MAXIMO_API_KEY);
}

async function request(path, options = {}) {
    if (!isConfigured()) {
        throw new Error("Maximo is not configured: set MAXIMO_BASE_URL and MAXIMO_API_KEY in .env");
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), MAXIMO_TIMEOUT_MS);

    try {
        const url = `${MAXIMO_BASE_URL}${path}`;
        console.log(`Making request to: ${url}`);
        
        const response = await fetchModule(url, {
            ...options,
            headers: {
                "Content-Type": "application/json",
                "apikey": MAXIMO_API_KEY,
                ...(options.headers || {}),
            },
            signal: controller.signal,
        });

        const text = await response.text();
        let body = null;
        try {
            body = text ? JSON.parse(text) : null;
        } catch {
            body = text;
        }

        if (!response.ok) {
            const error = new Error(`Maximo request failed: ${response.status} ${response.statusText}`);
            error.status = response.status;
            error.body = body;
            console.error('Maximo request failed:', error);
            throw error;
        }

        return body;
    } catch (error) {
        if (error.name === 'AbortError') {
            console.error('Maximo request timeout');
            throw new Error('Maximo request timeout');
        }
        throw error;
    } finally {
        clearTimeout(timer);
    }
}

async function testConnection() {
    console.log('Testing Maximo connection...');
    return request("/oslc/os/mxapiwo?lean=1&oslc.pageSize=1");
}

/**
 * Create work order in Maximo with proper asset linking and priority
 */
async function createWorkOrder(payload) {
    // Remove any orgid if present
    const cleanPayload = { ...payload };
    delete cleanPayload.orgid;
    delete cleanPayload.ORGID;

    // Ensure required fields
    if (!cleanPayload.wonum) {
        cleanPayload.wonum = `WO-${Date.now()}`;
    }

    // Set default site if not provided
    if (!cleanPayload.siteid) {
        cleanPayload.siteid = process.env.MAXIMO_SITE_ID || 'BEDFORD';
    }

    // Map priority correctly - Maximo uses 1-5 scale (1 = Highest)
    // Our system uses 1-5 where 1 = Critical, 5 = Low
    let priority = cleanPayload.priority || 2;
    // Ensure priority is between 1 and 5
    priority = Math.min(Math.max(parseInt(priority) || 2, 1), 5);
    cleanPayload.priority = priority;
    cleanPayload.wopriority = priority;

    // Ensure status is valid
    if (!cleanPayload.status) {
        cleanPayload.status = 'WAPPR'; // Waiting Approval
    }

    // Map worktype
    if (!cleanPayload.worktype) {
        cleanPayload.worktype = 'CM'; // Corrective Maintenance
    }

    // Ensure assetnum is valid
    if (!cleanPayload.assetnum) {
        console.warn('[maximoClient] No assetnum provided for work order creation');
        // Use a default asset if none provided
        cleanPayload.assetnum = '1000';
    }

    // Ensure description is provided
    if (!cleanPayload.description) {
        cleanPayload.description = `Work order for asset ${cleanPayload.assetnum}`;
    }

    console.log('[maximoClient] Creating work order with payload:', cleanPayload);

    try {
        const response = await request('/oslc/os/mxapiwo?lean=1', {
            method: "POST",
            body: JSON.stringify(cleanPayload),
        });
        console.log('[maximoClient] Work order created successfully:', response);
        return response;
    } catch (error) {
        console.error('[maximoClient] Failed to create work order:', error.message);
        if (error.body) {
            console.error('[maximoClient] Maximo error details:', JSON.stringify(error.body, null, 2));
        }
        throw error;
    }
}

/**
 * Get full work order details including status
 * Try multiple approaches to find the work order
 */
/**
 * Get full work order details including status
 * Try multiple approaches to find the work order
 */
async function getWorkOrder(wonum, siteId) {
    const site = siteId || "BEDFORD";
    
    try {
        // Approach 1: Try with site filter
        const query1 = `oslc.where=wonum="${wonum}" and siteid="${site}"&lean=1`;
        let response = await request(`/oslc/os/mxapiwo?${query1}`);

        // If not found, Approach 2: Try without site filter
        if (!response || !response.member || response.member.length === 0) {
            console.log(`[maximoClient] Work order ${wonum} not found with site filter, trying without site...`);
            const query2 = `oslc.where=wonum="${wonum}"&lean=1`;
            response = await request(`/oslc/os/mxapiwo?${query2}`);
        }

        // If still not found, Approach 3: Try to search by description containing the wonum
        // Use proper OSLC syntax with wildcard
        if (!response || !response.member || response.member.length === 0) {
            console.log(`[maximoClient] Work order ${wonum} not found, trying search by description...`);
            // Use a different approach - search for work orders with description like the wonum
            // Using a simpler query that Maximo will accept
            try {
                const query3 = `oslc.where=description like "%${wonum}%"&lean=1`;
                response = await request(`/oslc/os/mxapiwo?${query3}`);
            } catch (error) {
                // If like doesn't work, try a simple contains with proper escaping
                console.log(`[maximoClient] Like query failed, trying alternative...`);
                // Just return null and let the caller handle it
                return null;
            }
        }

        // If we got a reference, follow it to get full details
        if (response && response.member && response.member.length > 0) {
            const href = response.member[0].href;
            if (href) {
                // Extract the path from the href
                const pathMatch = href.match(/\/oslc\/os\/mxapiwo\/[^?]+/);
                if (pathMatch) {
                    // Get full record without lean=1
                    const fullResponse = await request(`${pathMatch[0]}?lean=0`);
                    return fullResponse;
                }
            }
        }

        // If no results found, return null
        console.log(`[maximoClient] Work order ${wonum} not found in Maximo`);
        return null;
    } catch (error) {
        // If it's a 400 error due to query syntax, just return null
        if (error.status === 400) {
            console.log(`[maximoClient] Query error for ${wonum}, work order likely doesn't exist`);
            return null;
        }
        console.error(`[maximoClient] Failed to get work order ${wonum}:`, error.message);
        throw error;
    }
}

/**
 * Get work order by ID with direct lookup
 */
async function getWorkOrderById(id, siteId) {
    const site = siteId || "BEDFORD";
    
    try {
        // Try with site filter first
        const query = `oslc.where=id="${id}" and siteid="${site}"&lean=1`;
        let response = await request(`/oslc/os/mxapiwo?${query}`);

        // If not found, try without site
        if (!response || !response.member || response.member.length === 0) {
            const query2 = `oslc.where=id="${id}"&lean=1`;
            response = await request(`/oslc/os/mxapiwo?${query2}`);
        }

        if (response && response.member && response.member.length > 0) {
            const href = response.member[0].href;
            if (href) {
                const pathMatch = href.match(/\/oslc\/os\/mxapiwo\/[^?]+/);
                if (pathMatch) {
                    const fullResponse = await request(`${pathMatch[0]}?lean=0`);
                    return fullResponse;
                }
            }
        }

        return null;
    } catch (error) {
        console.error(`[maximoClient] Failed to get work order by ID ${id}:`, error.message);
        return null;
    }
}

/**
 * Update work order status
 */
async function updateWorkOrderStatus(wonum, siteId, status) {
    const site = siteId || "BEDFORD";
    
    try {
        // First find the work order
        const searchResponse = await request(
            `/oslc/os/mxapiwo?oslc.where=wonum="${wonum}" and siteid="${site}"&lean=1`
        );

        if (!searchResponse || !searchResponse.member || searchResponse.member.length === 0) {
            throw new Error(`Work order ${wonum} not found in Maximo`);
        }

        const href = searchResponse.member[0].href;
        if (!href) {
            throw new Error(`No href found for work order ${wonum}`);
        }

        // Extract the path
        const pathMatch = href.match(/\/oslc\/os\/mxapiwo\/[^?]+/);
        if (!pathMatch) {
            throw new Error(`Invalid href format for work order ${wonum}`);
        }

        // Update the status using the full path
        const response = await request(`${pathMatch[0]}?lean=0`, {
            method: "POST",
            headers: { 
                "x-method-override": "PATCH", 
                "patchtype": "MERGE" 
            },
            body: JSON.stringify({ status: status }),
        });

        return response;
    } catch (error) {
        console.error(`[maximoClient] Failed to update work order ${wonum}:`, error.message);
        throw error;
    }
}

// Fetch assets from Maximo
async function fetchAssets(limit = 100) {
    console.log(`Fetching assets from Maximo (limit: ${limit})...`);
    try {
        const endpoints = [
            `/oslc/os/mxasset?lean=1&oslc.pageSize=${limit}`,
            `/oslc/os/mxassets?lean=1&oslc.pageSize=${limit}`,
            `/oslc/os/mxasset?oslc.select=assetnum,description,siteid,status&oslc.pageSize=${limit}`
        ];
        
        let response = null;
        
        for (const endpoint of endpoints) {
            try {
                response = await request(endpoint, { method: "GET" });
                if (response) break;
            } catch (error) {
                console.log(`Endpoint ${endpoint} failed:`, error.message);
            }
        }
        
        if (!response) {
            console.log('All asset endpoints failed, returning local assets');
            return getLocalAssets();
        }
        
        let assets = [];
        if (response && response.rdf && response.rdf.Description) {
            const descriptions = Array.isArray(response.rdf.Description) 
                ? response.rdf.Description 
                : [response.rdf.Description];
            
            assets = descriptions.map(desc => {
                const asset = {};
                if (desc['assetnum']) {
                    asset.assetnum = typeof desc['assetnum'] === 'object' 
                        ? desc['assetnum']['$'] 
                        : desc['assetnum'];
                }
                if (desc['description']) {
                    asset.description = typeof desc['description'] === 'object' 
                        ? desc['description']['$'] 
                        : desc['description'];
                }
                if (desc['siteid']) {
                    asset.siteid = typeof desc['siteid'] === 'object' 
                        ? desc['siteid']['$'] 
                        : desc['siteid'];
                }
                if (desc['status']) {
                    asset.status = typeof desc['status'] === 'object' 
                        ? desc['status']['$'] 
                        : desc['status'];
                }
                return asset;
            }).filter(a => a.assetnum);
        }
        
        if (assets.length === 0) {
            console.log('No assets found in Maximo, returning local assets');
            return getLocalAssets();
        }
        
        console.log(`Found ${assets.length} assets in Maximo`);
        return assets;
    } catch (error) {
        console.error('Error fetching assets from Maximo:', error.message);
        return getLocalAssets();
    }
}

// Fallback: Get assets from local database
async function getLocalAssets() {
    try {
        return [
            { assetnum: '1000', description: 'Asset 1000', status: 'OPERATING' },
            { assetnum: '1000-10', description: 'Asset 1000-10', status: 'OPERATING' },
            { assetnum: '1000-20', description: 'Asset 1000-20', status: 'OPERATING' },
            { assetnum: '1000-30', description: 'Asset 1000-30', status: 'OPERATING' },
            { assetnum: '1000-40', description: 'Asset 1000-40', status: 'OPERATING' },
            { assetnum: '1000-50', description: 'Asset 1000-50', status: 'OPERATING' },
            { assetnum: '1001', description: 'Asset 1001', status: 'OPERATING' },
            { assetnum: '1001-10', description: 'Asset 1001-10', status: 'OPERATING' },
            { assetnum: '1001-20', description: 'Asset 1001-20', status: 'OPERATING' },
            { assetnum: '1005', description: 'Asset 1005', status: 'OPERATING' },
            { assetnum: '1020', description: 'Asset 1020', status: 'OPERATING' },
            { assetnum: 'PUMP-101', description: 'Main Cooling Pump', status: 'OPERATING' },
            { assetnum: 'COMP-001', description: 'Air Compressor', status: 'OPERATING' },
        ];
    } catch (error) {
        console.error('Error getting local assets:', error);
        return [];
    }
}

module.exports = {
    isConfigured,
    request,
    testConnection,
    createWorkOrder,
    getWorkOrder,
    getWorkOrderById,
    updateWorkOrderStatus,
    fetchAssets,
};