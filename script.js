// Основные переменные
let currentUser = null;
let currentChat = null;
let chats = [];
let socket = null;

// DOM элементы
const userInfoElement = document.getElementById('userInfo');
const chatListElement = document.getElementById('chatList');
const messagesContainer = document.getElementById('messagesContainer');
const messageInput = document.getElementById('messageInput');
const sendMessageBtn = document.getElementById('sendMessageBtn');
const currentChatName = document.getElementById('currentChatName');

// Модальные окна
const newChatModal = document.getElementById('newChatModal');
const joinChatModal = document.getElementById('joinChatModal');
const chatSettingsModal = document.getElementById('chatSettingsModal');

// Кнопки
document.getElementById('newChatBtn').addEventListener('click', () => newChatModal.style.display = 'block');
document.getElementById('joinChatBtn').addEventListener('click', () => joinChatModal.style.display = 'block');
document.getElementById('chatSettingsBtn').addEventListener('click', showChatSettings);

// Закрытие модальных окон
document.querySelectorAll('.close').forEach(closeBtn => {
    closeBtn.addEventListener('click', function() {
        this.closest('.modal').style.display = 'none';
    });
});

// Создание чата
document.getElementById('createChatBtn').addEventListener('click', createNewChat);

// Присоединение к чату
document.getElementById('joinChatConfirmBtn').addEventListener('click', joinChat);

// Изменение пароля чата
document.getElementById('changePasswordBtn').addEventListener('click', changeChatPassword);

// Отправка сообщения
sendMessageBtn.addEventListener('click', sendMessage);
messageInput.addEventListener('keypress', function(e) {
    if (e.key === 'Enter') sendMessage();
});

// Проверка авторизации при загрузке
document.addEventListener('DOMContentLoaded', () => {
    const savedUser = localStorage.getItem('messengerUser');
    if (savedUser) {
        currentUser = JSON.parse(savedUser);
        userInfoElement.textContent = currentUser.username;
        connectToServer();
    } else {
        window.location.href = 'auth.html';
    }
});

// Подключение к серверу WebSocket
function connectToServer() {
    socket = new WebSocket('ws://localhost:3000'); // Замените на ваш URL сервера
    
    socket.onopen = () => {
        console.log('Connected to server');
        // Отправляем информацию о пользователе
        socket.send(JSON.stringify({
            type: 'auth',
            userId: currentUser.id,
            username: currentUser.username
        }));
        
        // Запрашиваем список чатов пользователя
        socket.send(JSON.stringify({
            type: 'get_chats',
            userId: currentUser.id
        }));
    };
    
    socket.onmessage = (event) => {
        const data = JSON.parse(event.data);
        console.log('Message from server:', data);
        
        switch(data.type) {
            case 'chats_list':
                updateChatList(data.chats);
                break;
            case 'chat_created':
                addNewChat(data.chat);
                break;
            case 'chat_joined':
                addNewChat(data.chat);
                selectChat(data.chat.id);
                break;
            case 'new_message':
                if (currentChat && currentChat.id === data.chatId) {
                    addMessageToChat(data.message, false);
                }
                break;
            case 'chat_messages':
                if (currentChat && currentChat.id === data.chatId) {
                    displayMessages(data.messages);
                }
                break;
            case 'chat_info':
                if (currentChat && currentChat.id === data.chat.id) {
                    currentChat = data.chat;
                    updateChatInfo();
                }
                break;
        }
    };
    
    socket.onclose = () => {
        console.log('Disconnected from server');
        setTimeout(connectToServer, 5000); // Попытка переподключения через 5 секунд
    };
}

// Обновление списка чатов
function updateChatList(serverChats) {
    chats = serverChats;
    chatListElement.innerHTML = '';
    
    chats.forEach(chat => {
        const chatElement = document.createElement('div');
        chatElement.className = 'chat-item';
        chatElement.textContent = chat.name;
        chatElement.addEventListener('click', () => selectChat(chat.id));
        chatListElement.appendChild(chatElement);
    });
}

// Добавление нового чата
function addNewChat(chat) {
    if (!chats.some(c => c.id === chat.id)) {
        chats.push(chat);
        updateChatList(chats);
    }
}

// Выбор чата
function selectChat(chatId) {
    currentChat = chats.find(chat => chat.id === chatId);
    currentChatName.textContent = currentChat.name;
    
    // Подсветка выбранного чата
    document.querySelectorAll('.chat-item').forEach(item => {
        item.classList.remove('active');
    });
    
    const selectedChat = Array.from(document.querySelectorAll('.chat-item')).find(item => {
        return item.textContent === currentChat.name;
    });
    
    if (selectedChat) {
        selectedChat.classList.add('active');
    }
    
    // Запрос сообщений для выбранного чата
    socket.send(JSON.stringify({
        type: 'get_messages',
        chatId: currentChat.id,
        userId: currentUser.id
    }));
    
    // Активация поля ввода сообщения
    messageInput.disabled = false;
    sendMessageBtn.disabled = false;
    messageInput.focus();
}

// Отображение сообщений
function displayMessages(messages) {
    messagesContainer.innerHTML = '';
    
    if (messages.length === 0) {
        messagesContainer.innerHTML = '<p class="no-messages">Нет сообщений в этом чате</p>';
        return;
    }
    
    messages.forEach(message => {
        const isCurrentUser = message.senderId === currentUser.id;
        addMessageToChat(message, isCurrentUser);
    });
    
    // Прокрутка вниз
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// Добавление сообщения в чат
function addMessageToChat(message, isCurrentUser) {
    const messageElement = document.createElement('div');
    messageElement.className = `message ${isCurrentUser ? 'user' : 'other'}`;
    
    const messageInfo = document.createElement('div');
    messageInfo.className = 'message-info';
    messageInfo.innerHTML = `
        <span class="message-sender">${isCurrentUser ? 'Вы' : message.senderName}</span>
        <span class="message-time">${new Date(message.timestamp).toLocaleTimeString()}</span>
    `;
    
    const messageText = document.createElement('div');
    messageText.className = 'message-text';
    messageText.textContent = message.text;
    
    messageElement.appendChild(messageInfo);
    messageElement.appendChild(messageText);
    messagesContainer.appendChild(messageElement);
    
    // Прокрутка вниз
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// Отправка сообщения
function sendMessage() {
    const text = messageInput.value.trim();
    if (!text || !currentChat || !socket) return;
    
    const message = {
        type: 'new_message',
        chatId: currentChat.id,
        senderId: currentUser.id,
        senderName: currentUser.username,
        text: text,
        timestamp: new Date().toISOString()
    };
    
    socket.send(JSON.stringify(message));
    addMessageToChat(message, true);
    messageInput.value = '';
}

// Создание нового чата
function createNewChat() {
    const name = document.getElementById('chatNameInput').value.trim();
    const password = document.getElementById('chatPasswordInput').value.trim();
    
    if (!name) {
        alert('Введите название чата');
        return;
    }
    
    socket.send(JSON.stringify({
        type: 'create_chat',
        name: name,
        password: password || null,
        creatorId: currentUser.id,
        creatorName: currentUser.username
    }));
    
    newChatModal.style.display = 'none';
    document.getElementById('chatNameInput').value = '';
    document.getElementById('chatPasswordInput').value = '';
}

// Присоединение к чату
function joinChat() {
    const chatId = document.getElementById('chatIdInput').value.trim();
    const password = document.getElementById('joinPasswordInput').value.trim();
    
    if (!chatId) {
        alert('Введите ID чата');
        return;
    }
    
    socket.send(JSON.stringify({
        type: 'join_chat',
        chatId: chatId,
        password: password || null,
        userId: currentUser.id,
        username: currentUser.username
    }));
    
    joinChatModal.style.display = 'none';
    document.getElementById('chatIdInput').value = '';
    document.getElementById('joinPasswordInput').value = '';
}

// Показать настройки чата
function showChatSettings() {
    if (!currentChat) return;
    
    document.getElementById('chatIdDisplay').textContent = currentChat.id;
    document.getElementById('newPasswordInput').value = '';
    chatSettingsModal.style.display = 'block';
}

// Изменить пароль чата
function changeChatPassword() {
    const newPassword = document.getElementById('newPasswordInput').value.trim();
    
    socket.send(JSON.stringify({
        type: 'change_chat_password',
        chatId: currentChat.id,
        userId: currentUser.id,
        newPassword: newPassword || null
    }));
    
    chatSettingsModal.style.display = 'none';
}

// Обновить информацию о чате
function updateChatInfo() {
    if (currentChat) {
        currentChatName.textContent = currentChat.name;
    }
}