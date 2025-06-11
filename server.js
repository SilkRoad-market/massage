const WebSocket = require('ws');
const express = require('express');
const http = require('http');
const { v4: uuidv4 } = require('uuid');

// Сервер Express для статических файлов
const app = express();
app.use(express.static('public'));

const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Имитация базы данных
let users = [];
let chats = [];
let messages = {};

// Имитация Telegram бота
const telegramBot = {
    sendCode: (userId, code) => {
        console.log(`[Telegram Bot] Код подтверждения для пользователя ${userId}: ${code}`);
        // В реальности здесь будет отправка сообщения через Telegram API
        return true;
    }
};

// Обработчик WebSocket соединений
wss.on('connection', (ws) => {
    console.log('Новое соединение');
    
    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);
            console.log('Получено сообщение:', data);
            
            switch(data.type) {
                case 'auth':
                    handleAuth(ws, data);
                    break;
                case 'get_chats':
                    handleGetChats(ws, data);
                    break;
                case 'create_chat':
                    handleCreateChat(ws, data);
                    break;
                case 'join_chat':
                    handleJoinChat(ws, data);
                    break;
                case 'get_messages':
                    handleGetMessages(ws, data);
                    break;
                case 'new_message':
                    handleNewMessage(ws, data);
                    break;
                case 'change_chat_password':
                    handleChangeChatPassword(ws, data);
                    break;
            }
        } catch (e) {
            console.error('Ошибка обработки сообщения:', e);
        }
    });
    
    ws.on('close', () => {
        console.log('Соединение закрыто');
    });
});

// Обработчики сообщений
function handleAuth(ws, data) {
    // В реальном приложении здесь должна быть проверка авторизации
    const user = {
        id: data.userId || uuidv4(),
        username: data.username,
        ws: ws
    };
    
    // Обновляем или добавляем пользователя
    const existingUserIndex = users.findIndex(u => u.id === user.id);
    if (existingUserIndex >= 0) {
        users[existingUserIndex].ws = ws;
    } else {
        users.push(user);
    }
    
    // Отправляем подтверждение авторизации
    ws.send(JSON.stringify({
        type: 'auth_success',
        userId: user.id,
        username: user.username
    }));
}

function handleGetChats(ws, data) {
    const userChats = chats.filter(chat => 
        chat.members.some(member => member.id === data.userId)
    );
    
    ws.send(JSON.stringify({
        type: 'chats_list',
        chats: userChats
    }));
}

function handleCreateChat(ws, data) {
    const chatId = uuidv4();
    const newChat = {
        id: chatId,
        name: data.name,
        password: data.password,
        creatorId: data.creatorId,
        members: [
            {
                id: data.creatorId,
                name: data.creatorName,
                isAdmin: true
            }
        ],
        createdAt: new Date().toISOString()
    };
    
    chats.push(newChat);
    messages[chatId] = [];
    
    // Отправляем создателю информацию о новом чате
    ws.send(JSON.stringify({
        type: 'chat_created',
        chat: newChat
    }));
}

function handleJoinChat(ws, data) {
    const chat = chats.find(c => c.id === data.chatId);
    
    if (!chat) {
        ws.send(JSON.stringify({
            type: 'chat_join_error',
            message: 'Чат не найден'
        }));
        return;
    }
    
    if (chat.password && chat.password !== data.password) {
        ws.send(JSON.stringify({
            type: 'chat_join_error',
            message: 'Неверный пароль'
        }));
        return;
    }
    
    // Проверяем, не является ли пользователь уже участником
    if (chat.members.some(m => m.id === data.userId)) {
        ws.send(JSON.stringify({
            type: 'chat_joined',
            chat: chat
        }));
        return;
    }
    
    // Добавляем пользователя в чат
    chat.members.push({
        id: data.userId,
        name: data.username,
        isAdmin: false
    });
    
    ws.send(JSON.stringify({
        type: 'chat_joined',
        chat: chat
    }));
}

function handleGetMessages(ws, data) {
    const chatMessages = messages[data.chatId] || [];
    ws.send(JSON.stringify({
        type: 'chat_messages',
        chatId: data.chatId,
        messages: chatMessages
    }));
}

function handleNewMessage(ws, data) {
    if (!messages[data.chatId]) {
        messages[data.chatId] = [];
    }
    
    const message = {
        id: uuidv4(),
        chatId: data.chatId,
        senderId: data.senderId,
        senderName: data.senderName,
        text: data.text,
        timestamp: data.timestamp
    };
    
    messages[data.chatId].push(message);
    
    // Отправляем сообщение всем участникам чата
    const chat = chats.find(c => c.id === data.chatId);
    if (chat) {
        chat.members.forEach(member => {
            const user = users.find(u => u.id === member.id);
            if (user && user.ws && user.ws.readyState === WebSocket.OPEN) {
                user.ws.send(JSON.stringify({
                    type: 'new_message',
                    chatId: data.chatId,
                    message: message
                }));
            }
        });
    }
}

function handleChangeChatPassword(ws, data) {
    const chat = chats.find(c => c.id === data.chatId);
    
    if (!chat) {
        ws.send(JSON.stringify({
            type: 'error',
            message: 'Чат не найден'
        }));
        return;
    }
    
    // Проверяем, является ли пользователь администратором чата
    const member = chat.members.find(m => m.id === data.userId && m.isAdmin);
    if (!member) {
        ws.send(JSON.stringify({
            type: 'error',
            message: 'Недостаточно прав'
        }));
        return;
    }
    
    // Изменяем пароль
    chat.password = data.newPassword;
    
    // Отправляем обновленную информацию о чате всем участникам
    chat.members.forEach(member => {
        const user = users.find(u => u.id === member.id);
        if (user && user.ws && user.ws.readyState === WebSocket.OPEN) {
            user.ws.send(JSON.stringify({
                type: 'chat_info',
                chat: chat
            }));
        }
    });
}

// Отдельный WebSocket для взаимодействия с Telegram ботом
const telegramWss = new WebSocket.Server({ noServer: true });

telegramWss.on('connection', (ws) => {
    console.log('Новое соединение с Telegram ботом');
    
    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);
            console.log('Сообщение от Telegram бота:', data);
            
            switch(data.type) {
                case 'request_code':
                    // Имитация отправки кода пользователю через Telegram
                    const success = telegramBot.sendCode(data.userId, data.code);
                    ws.send(JSON.stringify({
                        type: 'code_sent',
                        success: success
                    }));
                    break;
                    
                case 'verify_code':
                    // В реальном приложении здесь будет проверка кода через Telegram API
                    // Для демонстрации просто проверяем, что код не пустой
                    const isValid = data.code && data.code.length === 6;
                    
                    ws.send(JSON.stringify({
                        type: 'code_verified',
                        success: isValid,
                        userId: data.userId,
                        username: data.username,
                        telegramId: 'telegram_' + data.userId // Имитация Telegram ID
                    }));
                    break;
            }
        } catch (e) {
            console.error('Ошибка обработки сообщения от Telegram бота:', e);
        }
    });
});

// Обработка upgrade для Telegram WebSocket
server.on('upgrade', (request, socket, head) => {
    if (request.url === '/telegram') {
        telegramWss.handleUpgrade(request, socket, head, (ws) => {
            telegramWss.emit('connection', ws, request);
        });
    } else {
        wss.handleUpgrade(request, socket, head, (ws) => {
            wss.emit('connection', ws, request);
        });
    }
});

// Запуск сервера
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Сервер запущен на порту ${PORT}`);
});