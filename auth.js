document.addEventListener('DOMContentLoaded', () => {
    const requestCodeBtn = document.getElementById('requestCodeBtn');
    const verifyCodeBtn = document.getElementById('verifyCodeBtn');
    const usernameInput = document.getElementById('usernameInput');
    const codeInput = document.getElementById('codeInput');
    const codeSection = document.getElementById('codeSection');
    const authStatus = document.getElementById('authStatus');
    
    let verificationCode = '';
    let telegramBotSocket = null;
    
    // Подключение к боту Telegram
    function connectToTelegramBot() {
        telegramBotSocket = new WebSocket('ws://localhost:3000/telegram'); // Замените на ваш URL сервера
        
        telegramBotSocket.onopen = () => {
            console.log('Connected to Telegram bot gateway');
        };
        
        telegramBotSocket.onmessage = (event) => {
            const data = JSON.parse(event.data);
            console.log('Message from Telegram bot:', data);
            
            if (data.type === 'code_verified' && data.success) {
                // Сохраняем пользователя и перенаправляем в мессенджер
                const user = {
                    id: data.userId,
                    username: usernameInput.value.trim(),
                    telegramId: data.telegramId
                };
                
                localStorage.setItem('messengerUser', JSON.stringify(user));
                window.location.href = 'index.html';
            } else if (data.type === 'code_verified' && !data.success) {
                authStatus.textContent = 'Неверный код подтверждения';
                authStatus.style.color = 'red';
            }
        };
        
        telegramBotSocket.onclose = () => {
            console.log('Disconnected from Telegram bot gateway');
            setTimeout(connectToTelegramBot, 5000);
        };
    }
    
    // Запрос кода подтверждения
    requestCodeBtn.addEventListener('click', () => {
        const username = usernameInput.value.trim();
        
        if (!username) {
            authStatus.textContent = 'Введите ваше имя';
            authStatus.style.color = 'red';
            return;
        }
        
        // Генерируем случайный 6-значный код
        verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
        
        if (!telegramBotSocket || telegramBotSocket.readyState !== WebSocket.OPEN) {
            authStatus.textContent = 'Ошибка подключения к серверу. Попробуйте позже.';
            authStatus.style.color = 'red';
            return;
        }
        
        // Отправляем запрос на отправку кода через бота
        telegramBotSocket.send(JSON.stringify({
            type: 'request_code',
            code: verificationCode,
            username: username
        }));
        
        authStatus.textContent = 'Код отправлен в ваш Telegram. Проверьте сообщения от бота.';
        authStatus.style.color = 'green';
        codeSection.style.display = 'block';
    });
    
    // Проверка кода подтверждения
    verifyCodeBtn.addEventListener('click', () => {
        const enteredCode = codeInput.value.trim();
        
        if (!enteredCode) {
            authStatus.textContent = 'Введите код подтверждения';
            authStatus.style.color = 'red';
            return;
        }
        
        if (enteredCode !== verificationCode) {
            authStatus.textContent = 'Неверный код подтверждения';
            authStatus.style.color = 'red';
            return;
        }
        
        // Отправляем подтверждение на сервер
        telegramBotSocket.send(JSON.stringify({
            type: 'verify_code',
            code: enteredCode,
            username: usernameInput.value.trim()
        }));
        
        authStatus.textContent = 'Проверка кода...';
        authStatus.style.color = 'green';
    });
    
    // Инициализация подключения к боту
    connectToTelegramBot();
});