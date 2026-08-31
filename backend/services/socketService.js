const { Server: SocketIO } = require("socket.io");
const jwt = require("jsonwebtoken");
const { query, queryOne } = require("../db/pool");
const { JWT_SECRET } = require("../middleware/auth");

const VALID_CHANNELS = ["general", "random", "technical", "workorders", "alerts"];

function initSocket(server) {
    const io = new SocketIO(server, {
        cors: { origin: "*", methods: ["GET", "POST"], credentials: true },
        transports: ["websocket", "polling"],
    });

    io.use((socket, next) => {
        const token = socket.handshake.auth?.token;
        if (!token) return next(new Error("No token"));
        try {
            socket.user = jwt.verify(token, JWT_SECRET);
            next();
        } catch {
            next(new Error("Invalid token"));
        }
    });

    io.on("connection", async (socket) => {
        const user = socket.user;

        if (user?.id) {
            try {
                await query(
                    `MERGE user_presence AS t USING (SELECT @userId AS user_id) s ON t.user_id=s.user_id
                     WHEN MATCHED THEN UPDATE SET is_online=1, socket_id=@socketId, last_seen=GETDATE()
                     WHEN NOT MATCHED THEN INSERT (user_id, socket_id, is_online, last_seen) VALUES (@userId, @socketId, 1, GETDATE());`,
                    { userId: user.id, socketId: socket.id }
                );
                io.emit("chat:user:online", { id: user.id, name: user.name, email: user.email, role: user.role, is_online: true });
            } catch {
                // presence tracking is best-effort
            }
        }

        socket.on("chat:message", async (data) => {
            if (!data?.content?.trim() || !user?.id) return;
            const channel = VALID_CHANNELS.includes(data.channel) ? data.channel : "general";
            try {
                const rows = await query(
                    `INSERT INTO chat_messages (channel, user_id, content, reply_to_id)
                     OUTPUT INSERTED.id, INSERTED.created_at
                     VALUES (@channel, @userId, @content, @replyToId)`,
                    { channel, userId: user.id, content: data.content.trim().slice(0, 2000), replyToId: data.replyTo?.id || null }
                );
                io.emit("chat:message", {
                    id: rows[0].id, channel, content: data.content.trim(),
                    userId: user.id, username: user.name, replyTo: data.replyTo || null,
                    edited: false, pinned: false, timestamp: new Date(rows[0].created_at).getTime(),
                });
            } catch {
                socket.emit("chat:error", { message: "Failed to save message" });
            }
        });

        socket.on("chat:typing", (data) =>
            socket.broadcast.emit("chat:typing", { channel: data.channel, userId: user?.id, username: user?.name }));

        socket.on("chat:message:delete", async (data) => {
            if (!data?.messageId || !user?.id) return;
            const message = await queryOne(`SELECT user_id FROM chat_messages WHERE id=@id AND is_deleted=0`, { id: data.messageId });
            if (!message || (message.user_id !== user.id && user.role !== "it_admin")) return;
            await query(`UPDATE chat_messages SET is_deleted=1, updated_at=GETDATE() WHERE id=@id`, { id: data.messageId });
            io.emit("chat:message:delete", { messageId: data.messageId });
        });

        socket.on("chat:message:edit", async (data) => {
            if (!data?.messageId || !data?.content?.trim() || !user?.id) return;
            const message = await queryOne(`SELECT user_id FROM chat_messages WHERE id=@id AND is_deleted=0`, { id: data.messageId });
            if (!message || message.user_id !== user.id) return;
            const content = data.content.trim().slice(0, 2000);
            await query(`UPDATE chat_messages SET content=@content, is_edited=1, updated_at=GETDATE() WHERE id=@id`, { id: data.messageId, content });
            io.emit("chat:message:edit", { messageId: data.messageId, content });
        });

        socket.on("chat:message:pin", async (data) => {
            if (!data?.messageId || !user?.id) return;
            if (!["it_admin", "maintenance_engineer"].includes(user.role)) return;
            const message = await queryOne(`SELECT is_pinned FROM chat_messages WHERE id=@id AND is_deleted=0`, { id: data.messageId });
            if (!message) return;
            const pinned = message.is_pinned ? 0 : 1;
            await query(`UPDATE chat_messages SET is_pinned=@pinned, updated_at=GETDATE() WHERE id=@id`, { id: data.messageId, pinned });
            io.emit("chat:message:pin", { messageId: data.messageId, pinned: !!pinned });
        });

        socket.on("disconnect", async () => {
            if (!user?.id) return;
            try {
                await query(`UPDATE user_presence SET is_online=0, last_seen=GETDATE() WHERE user_id=@userId`, { userId: user.id });
                io.emit("chat:user:offline", { id: user.id });
            } catch {
                // presence tracking is best-effort
            }
        });
    });

    return io;
}

module.exports = { initSocket, VALID_CHANNELS };
