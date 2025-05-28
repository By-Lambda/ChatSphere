/**
 * Main JavaScript file for ChatSphere
 *
 * I created this script to handle the client-side functionality of ChatSphere, a real-time group chat application.
 * It manages password visibility toggling, user list rendering, channel management, private chat requests, and WebSocket communication.
 *
 * Author: [Ramin Riahi]
 * Created: May 2025
 */

document.addEventListener('DOMContentLoaded', () => {
    // Handle password visibility toggle (for login and register pages)
    const toggleIcons = document.querySelectorAll('.password-toggle-icon');
    toggleIcons.forEach(toggle => {
        toggle.addEventListener('click', () => {
            const input = toggle.closest('.input-group').querySelector('.password-input');
            const icon = toggle.querySelector('i');
            if (input.type === 'password') {
                input.type = 'text';
                icon.classList.remove('bi-eye-slash');
                icon.classList.add('bi-eye');
            } else {
                input.type = 'password';
                icon.classList.remove('bi-eye');
                icon.classList.add('bi-eye-slash');
            }
        });
    });

    // Initialize user list from DOM elements
    let users = Array.from(document.querySelectorAll('.user-item')).map(item => ({
        username: item.dataset.username,
        online: item.classList.contains('online-user')
    }));

    /**
     * Render the user list dynamically.
     * I designed this function to display online and offline users with counts and interactive buttons for private chat requests.
     * @param {Array} updatedUsers - List of users to render (default: global users array)
     */
    function renderUserList(updatedUsers = users) {
        const userList = document.getElementById('user-list');
        userList.innerHTML = ''; // Clear the current list

        // Calculate counts of online and offline users
        const onlineUsers = updatedUsers.filter(user => user.online);
        const offlineUsers = updatedUsers.filter(user => !user.online);

        // Add "Online" label with count
        const onlineLabel = document.createElement('li');
        onlineLabel.classList.add('list-group-item', 'user-label');
        onlineLabel.textContent = `Online - ${onlineUsers.length}`;
        userList.appendChild(onlineLabel);

        // Render online users
        onlineUsers.forEach(user => {
            const wrapper = document.createElement('li');
            wrapper.classList.add('user-item-wrapper');

            const newItem = document.createElement('button');
            newItem.type = 'button';
            newItem.classList.add('list-group-item', 'user-item', 'online-user');
            newItem.dataset.username = user.username;
            newItem.textContent = user.username === username ? `${user.username} (me)` : user.username;
            newItem.style.color = '#28a745'; // Green for online users

            // Add click event to show "Request Private Chat" option
            newItem.addEventListener('click', (e) => {
                e.stopPropagation(); // Prevent closing the option when clicking the button
                const clickedUsername = newItem.dataset.username;

                // Do not show the option for the current user
                if (clickedUsername === username) return;

                // Remove any existing options
                document.querySelectorAll('.chat-request-option').forEach(option => option.remove());

                // Create "Request Private Chat" option
                const option = document.createElement('div');
                option.classList.add('chat-request-option');
                option.textContent = 'Request Private Chat';
                wrapper.appendChild(option);

                // Handle click on the option
                option.addEventListener('click', () => {
                    option.remove(); // Remove the option immediately after clicking
                    socket.emit('request_private_chat', { from: username, to: clickedUsername });
                });
            });

            wrapper.appendChild(newItem);
            userList.appendChild(wrapper);
        });

        // Add "Offline" label with count
        const offlineLabel = document.createElement('li');
        offlineLabel.classList.add('list-group-item', 'user-label');
        offlineLabel.textContent = `Offline - ${offlineUsers.length}`;
        userList.appendChild(offlineLabel);

        // Render offline users
        offlineUsers.forEach(user => {
            const wrapper = document.createElement('li');
            wrapper.classList.add('user-item-wrapper');

            const newItem = document.createElement('button');
            newItem.type = 'button';
            newItem.classList.add('list-group-item', 'user-item', 'offline-user');
            newItem.dataset.username = user.username;
            newItem.textContent = user.username === username ? `${user.username} (me)` : user.username;
            newItem.style.color = '#6c757d'; // Gray for offline users

            // Add click event to show "Request Private Chat" option
            newItem.addEventListener('click', (e) => {
                e.stopPropagation(); // Prevent closing the option when clicking the button
                const clickedUsername = newItem.dataset.username;

                // Do not show the option for the current user
                if (clickedUsername === username) return;

                // Remove any existing options
                document.querySelectorAll('.chat-request-option').forEach(option => option.remove());

                // Create "Request Private Chat" option
                const option = document.createElement('div');
                option.classList.add('chat-request-option');
                option.textContent = 'Request Private Chat';
                wrapper.appendChild(option);

                // Handle click on the option
                option.addEventListener('click', () => {
                    option.remove(); // Remove the option immediately after clicking
                    socket.emit('request_private_chat', { from: username, to: clickedUsername });
                });
            });

            wrapper.appendChild(newItem);
            userList.appendChild(wrapper);
        });
    }

    /**
     * Render the default animated message in the chat box.
     * I created this function to display a welcome animation when no channel is active.
     */
    function renderDefaultMessage() {
        chatBox.innerHTML = ''; // Clear current content

        // Create container for the animated message
        const container = document.createElement('div');
        container.classList.add('default-message-container');

        // Add "ChatSphere" title with animation
        const title = document.createElement('h1');
        title.textContent = 'ChatSphere';
        title.classList.add('default-message-title');
        title.setAttribute('onselectstart', 'return false');
        title.setAttribute('oncopy', 'return false');

        // Add description text with fade-in effect
        const description = document.createElement('p');
        description.textContent = 'Connect with your world';
        description.classList.add('default-message-description');

        // Add "Created by Ramin" text with scale effect
        const builtBy = document.createElement('p');
        builtBy.textContent = 'Created by Ramin';
        builtBy.classList.add('default-message-built-by');

        // Append all elements to the container
        container.appendChild(title);
        container.appendChild(description);
        container.appendChild(builtBy);
        chatBox.appendChild(container);
    }

    // Initial render of the user list
    renderUserList();

    // Close private chat options when clicking outside
    document.addEventListener('click', (e) => {
        document.querySelectorAll('.chat-request-option').forEach(option => {
            if (!option.contains(e.target)) {
                option.remove();
            }
        });
    });

    // Chat Management
    const socket = io();
    let activeChannels = JSON.parse(sessionStorage.getItem('activeChannels')) || [];
    let currentActiveChannel = null;
    let privateChatRequests = JSON.parse(sessionStorage.getItem('privateChatRequests')) || [];
    let viewedRequests = JSON.parse(sessionStorage.getItem('viewedRequests')) || [];
    let privateChats = JSON.parse(sessionStorage.getItem('privateChats')) || [];
    let viewedChats = JSON.parse(sessionStorage.getItem('viewedChats')) || [];

    const channelList = document.getElementById('channel-list');
    const chatBox = document.getElementById('chat-box');
    const chatHeader = document.getElementById('chat-header');
    const channelName = document.getElementById('channel-name');
    const chatInput = document.getElementById('chat-input');
    const messageInput = document.getElementById('message-input');
    const sendButton = document.getElementById('send-button');

    /**
     * Enable or disable the chat input field.
     * I wrote this function to control the visibility and state of the message input area.
     * @param {boolean} enabled - Whether to enable the chat input
     */
    function toggleChatInput(enabled) {
        chatInput.style.display = enabled ? 'flex' : 'none';
        messageInput.disabled = !enabled;
        sendButton.disabled = !enabled;
    }

    /**
     * Render the "Accept" button for private chat requests.
     * I designed this function to allow users to accept private chat requests and join the chat.
     * @param {string} request - The username of the user who sent the request
     */
    function renderAcceptButton(request) {
        const acceptButton = document.createElement('button');
        acceptButton.classList.add('btn', 'btn-success', 'accept-button');
        acceptButton.textContent = 'Accept';
        acceptButton.addEventListener('click', () => {
            socket.emit('accept_private_chat', { from: request, to: username });
            acceptButton.remove();

            // Remove the request from the list
            privateChatRequests = privateChatRequests.filter(req => req !== request);
            sessionStorage.setItem('privateChatRequests', JSON.stringify(privateChatRequests));
            viewedRequests = viewedRequests.filter(req => req !== request);
            sessionStorage.setItem('viewedRequests', JSON.stringify(viewedRequests));

            // Set up the private chat tab for the accepting user
            const displayName = request;
            if (!privateChats.some(chat => chat.displayName === displayName)) {
                const privateChannel = `${[request, username].sort().join('_')}`;
                privateChats.push({ displayName: displayName, channel: privateChannel });
                sessionStorage.setItem('privateChats', JSON.stringify(privateChats));
            }

            // Mark the chat as viewed
            if (!viewedChats.includes(displayName)) {
                viewedChats.push(displayName);
                sessionStorage.setItem('viewedChats', JSON.stringify(viewedChats));
            }

            // Set the active channel and load the chat
            currentActiveChannel = displayName;
            renderChannelButtons();
            chatBox.innerHTML = '';
            chatHeader.textContent = currentActiveChannel;
            chatHeader.style.display = 'block';
            chatBox.style.borderTopLeftRadius = '0';
            chatBox.style.borderTopRightRadius = '0';
            socket.emit('join', { channel: [request, username].sort().join('_') });
            toggleChatInput(true);
        });
        chatBox.appendChild(acceptButton);
    }

    /**
     * Render channel buttons, private chat requests, and private chats.
     * I created this function to dynamically render buttons for all channels and chats.
     */
    function renderChannelButtons() {
        channelName.innerHTML = '';

        // Render public channels
        activeChannels.forEach(channel => {
            const buttonWrapper = document.createElement('div');
            buttonWrapper.classList.add('channel-button-wrapper');

            const button = document.createElement('button');
            button.classList.add('btn', 'btn-outline-primary', 'channel-button');
            if (channel === currentActiveChannel) {
                button.classList.add('active');
            }
            button.textContent = channel;
            button.dataset.channel = channel;
            button.addEventListener('click', () => {
                if (currentActiveChannel !== channel) {
                    currentActiveChannel = channel;
                    renderChannelButtons();
                    chatBox.innerHTML = '';
                    chatHeader.textContent = currentActiveChannel;
                    chatHeader.style.display = 'block';
                    chatBox.style.borderTopLeftRadius = '0';
                    chatBox.style.borderTopRightRadius = '0';
                    socket.emit('join', { channel: currentActiveChannel });
                    toggleChatInput(true);
                }
            });

            const closeButton = document.createElement('button');
            closeButton.classList.add('channel-close-btn');
            closeButton.innerHTML = '<i class="bi bi-x"></i>';
            closeButton.addEventListener('click', () => {
                activeChannels = activeChannels.filter(ch => ch !== channel);
                sessionStorage.setItem('activeChannels', JSON.stringify(activeChannels));
                socket.emit('leave', { channel: channel });
                if (currentActiveChannel === channel) {
                    currentActiveChannel = activeChannels.length > 0 ? activeChannels[0] : null;
                    chatBox.innerHTML = '';
                    chatHeader.textContent = currentActiveChannel || '';
                    if (currentActiveChannel) {
                        chatHeader.style.display = 'block';
                        chatBox.style.borderTopLeftRadius = '0';
                        chatBox.style.borderTopRightRadius = '0';
                        socket.emit('join', { channel: currentActiveChannel });
                        toggleChatInput(true);
                    } else {
                        chatHeader.style.display = 'none';
                        chatBox.style.borderTopLeftRadius = '8px';
                        chatBox.style.borderTopRightRadius = '8px';
                        renderDefaultMessage();
                        toggleChatInput(false);
                    }
                }
                renderChannelButtons();
            });

            buttonWrapper.appendChild(button);
            buttonWrapper.appendChild(closeButton);
            channelName.appendChild(buttonWrapper);
        });

        // Render private chat requests
        privateChatRequests.forEach(request => {
            const buttonWrapper = document.createElement('div');
            buttonWrapper.classList.add('channel-button-wrapper');

            const button = document.createElement('button');
            button.classList.add('btn', 'btn-outline-primary', 'channel-button');
            if (request === currentActiveChannel) {
                button.classList.add('active');
            }
            button.textContent = request;

            // Add a red dot indicator if the request is unseen
            if (!viewedRequests.includes(request)) {
                const newIndicator = document.createElement('span');
                newIndicator.classList.add('new-indicator');
                button.appendChild(newIndicator);
            }

            button.dataset.request = request;
            button.addEventListener('click', () => {
                if (currentActiveChannel !== request) {
                    currentActiveChannel = request;

                    // Mark the request as viewed
                    if (!viewedRequests.includes(request)) {
                        viewedRequests.push(request);
                        sessionStorage.setItem('viewedRequests', JSON.stringify(viewedRequests));
                    }

                    renderChannelButtons();
                    chatBox.innerHTML = '';
                    chatHeader.textContent = request;
                    chatHeader.style.display = 'block';
                    chatBox.style.borderTopLeftRadius = '0';
                    chatBox.style.borderTopRightRadius = '0';
                    toggleChatInput(false);
                    renderAcceptButton(request);
                }
            });

            const closeButton = document.createElement('button');
            closeButton.classList.add('channel-close-btn');
            closeButton.innerHTML = '<i class="bi bi-x"></i>';
            closeButton.addEventListener('click', () => {
                privateChatRequests = privateChatRequests.filter(req => req !== request);
                sessionStorage.setItem('privateChatRequests', JSON.stringify(privateChatRequests));

                // Remove from viewed requests if the tab is closed
                viewedRequests = viewedRequests.filter(req => req !== request);
                sessionStorage.setItem('viewedRequests', JSON.stringify(viewedRequests));

                if (currentActiveChannel === request) {
                    currentActiveChannel = activeChannels.length > 0 ? activeChannels[0] : null;
                    chatBox.innerHTML = '';
                    chatHeader.textContent = currentActiveChannel || '';
                    if (currentActiveChannel) {
                        chatHeader.style.display = 'block';
                        chatBox.style.borderTopLeftRadius = '0';
                        chatBox.style.borderTopRightRadius = '0';
                        socket.emit('join', { channel: currentActiveChannel });
                        toggleChatInput(true);
                    } else {
                        chatHeader.style.display = 'none';
                        chatBox.style.borderTopLeftRadius = '8px';
                        chatBox.style.borderTopRightRadius = '8px';
                        renderDefaultMessage();
                        toggleChatInput(false);
                    }
                }
                renderChannelButtons();
            });

            buttonWrapper.appendChild(button);
            buttonWrapper.appendChild(closeButton);
            channelName.appendChild(buttonWrapper);
        });

        // Render private chat tabs
        privateChats.forEach(chat => {
            const buttonWrapper = document.createElement('div');
            buttonWrapper.classList.add('channel-button-wrapper');

            const button = document.createElement('button');
            button.classList.add('btn', 'btn-outline-primary', 'channel-button');
            if (chat.displayName === currentActiveChannel) {
                button.classList.add('active');
            }
            button.textContent = chat.displayName;
            button.dataset.channel = chat.channel;
            button.addEventListener('click', () => {
                if (currentActiveChannel !== chat.displayName) {
                    currentActiveChannel = chat.displayName;

                    // Mark the chat as viewed
                    if (!viewedChats.includes(chat.displayName)) {
                        viewedChats.push(chat.displayName);
                        sessionStorage.setItem('viewedChats', JSON.stringify(viewedChats));
                    }

                    renderChannelButtons();
                    chatBox.innerHTML = '';
                    chatHeader.textContent = currentActiveChannel;
                    chatHeader.style.display = 'block';
                    chatBox.style.borderTopLeftRadius = '0';
                    chatBox.style.borderTopRightRadius = '0';
                    socket.emit('join', { channel: chat.channel });
                    toggleChatInput(true);
                }
            });

            const closeButton = document.createElement('button');
            closeButton.classList.add('channel-close-btn');
            closeButton.innerHTML = '<i class="bi bi-x"></i>';
            closeButton.addEventListener('click', () => {
                privateChats = privateChats.filter(ch => ch.displayName !== chat.displayName);
                sessionStorage.setItem('privateChats', JSON.stringify(privateChats));
                socket.emit('leave', { channel: chat.channel });
                viewedChats = viewedChats.filter(ch => ch !== chat.displayName);
                sessionStorage.setItem('viewedChats', JSON.stringify(viewedChats));

                // Notify the other user to close the tab
                const otherUser = chat.displayName;
                socket.emit('close_private_chat', { from: username, to: otherUser, channel: chat.channel });

                if (currentActiveChannel === chat.displayName) {
                    currentActiveChannel = activeChannels.length > 0 ? activeChannels[0] : null;
                    chatBox.innerHTML = '';
                    chatHeader.textContent = currentActiveChannel || '';
                    if (currentActiveChannel) {
                        chatHeader.style.display = 'block';
                        chatBox.style.borderTopLeftRadius = '0';
                        chatBox.style.borderTopRightRadius = '0';
                        socket.emit('join', { channel: currentActiveChannel });
                        toggleChatInput(true);
                    } else {
                        chatHeader.style.display = 'none';
                        chatBox.style.borderTopLeftRadius = '8px';
                        chatBox.style.borderTopRightRadius = '8px';
                        renderDefaultMessage();
                        toggleChatInput(false);
                    }
                }
                renderChannelButtons();
            });

            // Add a red dot indicator if the chat is unseen and the user is not the requester
            if (!viewedChats.includes(chat.displayName) && chat.displayName !== username) {
                const newIndicator = document.createElement('span');
                newIndicator.classList.add('new-indicator');
                button.appendChild(newIndicator);
            }

            buttonWrapper.appendChild(button);
            buttonWrapper.appendChild(closeButton);
            channelName.appendChild(buttonWrapper);
        });
    }

    // Initial render after page load
    renderChannelButtons();
    if (!currentActiveChannel) {
        renderDefaultMessage();
    }

    // Handle channel clicks
    if (channelList) {
        channelList.addEventListener('click', (e) => {
            const clickedItem = e.target.closest('.list-group-item');
            if (clickedItem) {
                const newChannel = clickedItem.textContent;
                if (!activeChannels.includes(newChannel)) {
                    activeChannels.push(newChannel);
                    sessionStorage.setItem('activeChannels', JSON.stringify(activeChannels));
                    socket.emit('join', { channel: newChannel });
                }
                if (currentActiveChannel !== newChannel) {
                    currentActiveChannel = newChannel;
                    chatBox.innerHTML = '';
                    chatHeader.textContent = currentActiveChannel;
                    chatHeader.style.display = 'block';
                    chatBox.style.borderTopLeftRadius = '0';
                    chatBox.style.borderTopRightRadius = '0';
                    socket.emit('join', { channel: currentActiveChannel });
                    toggleChatInput(true);
                }
                renderChannelButtons();
            }
        });
    }

    // Send messages
    if (sendButton && messageInput) {
        sendButton.addEventListener('click', () => {
            if (currentActiveChannel && messageInput.value.trim()) {
                const message = messageInput.value.trim();
                const timestamp = new Date().toLocaleTimeString();
                const messageElement = document.createElement('div');
                messageElement.classList.add('message');
                messageElement.innerHTML = `<strong>${username}</strong> (${timestamp}): ${message}`;
                chatBox.appendChild(messageElement);
                chatBox.scrollTop = chatBox.scrollHeight;

                // Find the real channel for private chats
                const privateChat = privateChats.find(chat => chat.displayName === currentActiveChannel);
                const channel = privateChat ? privateChat.channel : currentActiveChannel;
                socket.emit('message', { channel: channel, message });
                messageInput.value = '';
            }
        });

        messageInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && currentActiveChannel) {
                sendButton.click();
            }
        });
    }

    // Receive and display messages
    socket.on('load_messages', (messages) => {
        if (chatBox && currentActiveChannel) {
            chatBox.innerHTML = '';
            messages.forEach(msg => {
                const messageElement = document.createElement('div');
                messageElement.classList.add('message');
                messageElement.innerHTML = `<strong>${msg.username}</strong> (${new Date(msg.timestamp).toLocaleTimeString()}): ${msg.message}`;
                chatBox.appendChild(messageElement);
            });
            chatBox.scrollTop = chatBox.scrollHeight;
        }
    });

    socket.on('new_message', (data) => {
        if (chatBox) {
            const privateChat = privateChats.find(chat => chat.channel === data.channel);
            const channelName = privateChat ? privateChat.displayName : data.channel;
            if (activeChannels.includes(channelName) || privateChats.some(chat => chat.displayName === channelName)) {
                if (channelName === currentActiveChannel && data.username !== username) {
                    const messageElement = document.createElement('div');
                    messageElement.classList.add('message');
                    messageElement.innerHTML = `<strong>${data.username}</strong> (${new Date().toLocaleTimeString()}): ${data.message}`;
                    chatBox.appendChild(messageElement);
                    chatBox.scrollTop = chatBox.scrollHeight;
                }
            }
        }
    });

    // Update user list based on status changes
    socket.on('user_status', (data) => {
        const userIndex = users.findIndex(user => user.username === data.username);
        if (userIndex !== -1) {
            users[userIndex].online = data.online;
        } else {
            users.push({ username: data.username, online: data.online });
        }

        renderUserList(users);

        // Update the current user's status
        if (data.username === username) {
            const userList = document.getElementById('user-list');
            const currentUserItem = Array.from(userList.children)
                .filter(item => item.classList.contains('user-item-wrapper'))
                .find(wrapper => wrapper.querySelector('.user-item')?.dataset.username === username);
            if (currentUserItem) {
                const currentUserButton = currentUserItem.querySelector('.user-item');
                currentUserButton.classList.toggle('online-user', data.online);
                currentUserButton.classList.toggle('offline-user', !data.online);
                currentUserButton.style.color = data.online ? '#28a745' : '#6c757d';
            }
        }
    });

    // Handle incoming private chat requests
    socket.on('request_private_chat', (data) => {
        if (data.to === username && !privateChatRequests.includes(data.from)) {
            privateChatRequests.push(data.from);
            sessionStorage.setItem('privateChatRequests', JSON.stringify(privateChatRequests));
            renderChannelButtons();
        }
    });

    // Remove request after acceptance
    socket.on('remove_request', (data) => {
        privateChatRequests = privateChatRequests.filter(req => req !== data.request);
        sessionStorage.setItem('privateChatRequests', JSON.stringify(privateChatRequests));
        viewedRequests = viewedRequests.filter(req => req !== data.request);
        sessionStorage.setItem('viewedRequests', JSON.stringify(viewedRequests));
        renderChannelButtons();
    });

    // Start a private chat
    socket.on('start_private_chat', (data) => {
        if (data.from === username || data.to === username) {
            const otherUser = data.from === username ? data.to : data.from;
            const displayName = otherUser;
            privateChatRequests = privateChatRequests.filter(req => req !== data.from && req !== data.to);
            sessionStorage.setItem('privateChatRequests', JSON.stringify(privateChatRequests));
            viewedRequests = viewedRequests.filter(req => req !== data.from && req !== data.to);
            sessionStorage.setItem('viewedRequests', JSON.stringify(viewedRequests));

            if (!privateChats.some(chat => chat.displayName === displayName)) {
                privateChats.push({ displayName: displayName, channel: data.channel });
                sessionStorage.setItem('privateChats', JSON.stringify(privateChats));
            }

            renderChannelButtons();
        }
    });

    // Close private chat tab for the other user
    socket.on('close_private_chat', (data) => {
        if (data.to === username || data.from === username) {
            const chatToRemove = privateChats.find(chat => chat.channel === data.channel);
            if (chatToRemove) {
                privateChats = privateChats.filter(chat => chat.channel !== data.channel);
                sessionStorage.setItem('privateChats', JSON.stringify(privateChats));
                viewedChats = viewedChats.filter(ch => ch !== chatToRemove.displayName);
                sessionStorage.setItem('viewedChats', JSON.stringify(viewedChats));

                if (currentActiveChannel === chatToRemove.displayName) {
                    currentActiveChannel = activeChannels.length > 0 ? activeChannels[0] : null;
                    chatBox.innerHTML = '';
                    chatHeader.textContent = currentActiveChannel || '';
                    if (currentActiveChannel) {
                        chatHeader.style.display = 'block';
                        chatBox.style.borderTopLeftRadius = '0';
                        chatBox.style.borderTopRightRadius = '0';
                        socket.emit('join', { channel: currentActiveChannel });
                        toggleChatInput(true);
                    } else {
                        chatHeader.style.display = 'none';
                        chatBox.style.borderTopLeftRadius = '8px';
                        chatBox.style.borderTopRightRadius = '8px';
                        renderDefaultMessage();
                        toggleChatInput(false);
                    }
                }
                renderChannelButtons();
            }
        }
    });

    // Synchronize after connection
    socket.on('connect', () => {
        if ('username' in sessionStorage && !sessionStorage.getItem('is_logged_out')) {
            const username = sessionStorage.getItem('username');
            socket.emit('rejoin_channels', { username: username, channels: activeChannels });
            socket.emit('check_private_requests', { username: username });
            privateChats.forEach(chat => {
                socket.emit('join', { channel: chat.channel });
            });
        }
        renderChannelButtons();
        if (!currentActiveChannel) {
            renderDefaultMessage();
        }
    });

    // Receive channel status from the server
    socket.on('rejoin_channels_response', (data) => {
        activeChannels = data.channels || [];
        sessionStorage.setItem('activeChannels', JSON.stringify(activeChannels));
        if (currentActiveChannel && !activeChannels.includes(currentActiveChannel)) {
            currentActiveChannel = activeChannels.length > 0 ? activeChannels[0] : null;
        }
        renderChannelButtons();
        if (currentActiveChannel) {
            socket.emit('join', { channel: currentActiveChannel });
            toggleChatInput(true);
        } else {
            renderDefaultMessage();
        }
    });

    // Receive private chat requests from the server
    socket.on('check_private_requests_response', (data) => {
        privateChatRequests = data.requests || [];
        sessionStorage.setItem('privateChatRequests', JSON.stringify(privateChatRequests));
        renderChannelButtons();
        if (!currentActiveChannel) {
            renderDefaultMessage();
        }
    });

    // Send refresh event before closing or refreshing the page
    window.addEventListener('beforeunload', () => {
        sessionStorage.setItem('activeChannels', JSON.stringify(activeChannels));
        sessionStorage.setItem('privateChatRequests', JSON.stringify(privateChatRequests));
        sessionStorage.setItem('viewedRequests', JSON.stringify(viewedRequests));
        sessionStorage.setItem('privateChats', JSON.stringify(privateChats));
        sessionStorage.setItem('viewedChats', JSON.stringify(viewedChats));
        socket.emit('refresh');
    });
});