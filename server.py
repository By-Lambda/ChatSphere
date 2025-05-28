"""
ChatSphere - A Real-Time Group Chat Application

This file serves as the backend for ChatSphere, a web-based group chat application I developed.
It uses Flask and Flask-SocketIO to handle HTTP routes and WebSocket events, enabling real-time
communication between users. The app supports group channels, private chats, user authentication,
and online/offline status tracking. SQLite is used as the database to store users, messages,
channels, and sessions.

Author: [Ramin Riahi]
Created: May 2025
"""

# Import necessary libraries
from flask import Flask, render_template, request, redirect, url_for, session
from flask_socketio import SocketIO, emit, join_room, leave_room
import sqlite3
from datetime import datetime
from dotenv import load_dotenv
import os

load_dotenv()

# Initialize Flask app and SocketIO
app = Flask(__name__)
app.config['SECRET_KEY'] = os.getenv('FLASK_SECRET_KEY')  # TODO: Replace with a secure secret key in production
socketio = SocketIO(app)

# ------------------------- Database Setup -------------------------

def init_db():
    """
    Initialize the SQLite database by creating necessary tables if they don't exist.
    I created this function to set up the database schema for users, messages, channels, and sessions.
    It also populates the channels table with default channels.
    """
    with sqlite3.connect('database.db') as conn:
        cursor = conn.cursor()
        # Create users table to store user credentials and online status
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS users
            (username TEXT PRIMARY KEY, password TEXT, online INTEGER DEFAULT 0)
        ''')
        # Create messages table to store chat messages with timestamps
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS messages
            (channel TEXT, username TEXT, message TEXT, timestamp DATETIME DEFAULT CURRENT_TIMESTAMP)
        ''')
        # Create channels table to store available chat channels
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS channels
            (name TEXT PRIMARY KEY)
        ''')
        # Create sessions table to track user sessions for WebSocket connections
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS sessions
            (username TEXT, sid TEXT, PRIMARY KEY (username, sid),
             FOREIGN KEY (username) REFERENCES users(username))
        ''')
        # Populate default channels if they don't exist
        default_channels = ['General', 'Support', 'Off-Topic']
        for channel in default_channels:
            cursor.execute('INSERT OR IGNORE INTO channels (name) VALUES (?)', (channel,))
        conn.commit()

def migrate_db():
    """
    Migrate the database schema to add the 'online' column to the users table if it doesn't exist.
    I wrote this function to handle database migrations and ensure backward compatibility.
    It also creates the sessions table if it's missing.
    """
    with sqlite3.connect('database.db') as conn:
        cursor = conn.cursor()
        # Check if the 'online' column exists in the users table
        cursor.execute('PRAGMA table_info(users)')
        columns = [col[1] for col in cursor.fetchall()]
        if 'online' not in columns:
            cursor.execute('ALTER TABLE users ADD COLUMN online INTEGER DEFAULT 0')
            conn.commit()
        # Check if the sessions table exists, create it if not
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='sessions'")
        if not cursor.fetchone():
            cursor.execute('''
                CREATE TABLE sessions
                (username TEXT, sid TEXT, PRIMARY KEY (username, sid),
                 FOREIGN KEY (username) REFERENCES users(username))
            ''')
            conn.commit()

# Initialize and migrate the database when the app starts
init_db()
migrate_db()

# ------------------------- Flask Routes -------------------------

@app.route('/')
def index():
    """
    Handle the main chat page route.
    I designed this route to check if a user is logged in and redirect them to the login page if not.
    If the user is logged in, it loads the chat interface with available channels and users.
    """
    # Redirect to login if the user is not logged in
    if 'username' not in session:
        return redirect(url_for('login'))
    
    username = session['username']
    
    with sqlite3.connect('database.db') as conn:
        cursor = conn.cursor()
        # Verify if the user still exists in the database
        cursor.execute('SELECT 1 FROM users WHERE username = ?', (username,))
        if not cursor.fetchone():
            session.clear()  # Clear session if the user is not found
            return redirect(url_for('login'))
        
        # Set the current user as online in the database
        cursor.execute('UPDATE users SET online = 1 WHERE username = ?', (username,))
        conn.commit()

        # Fetch all available channels
        cursor.execute('SELECT name FROM channels')
        channels = [row[0] for row in cursor.fetchall()]
        
        # Fetch all users and their online status
        cursor.execute('SELECT username, online FROM users')
        raw_users = cursor.fetchall()
        users = [{'username': row[0], 'online': bool(row[1])} for row in raw_users]
    
    # Mark the user as online in the session
    session['is_online'] = True
    
    # Render the chat interface with user data
    return render_template('chat.html', username=username, channels=channels, users=users, current_channel=None)

@app.route('/login', methods=['GET', 'POST'])
def login():
    """
    Handle user login functionality.
    I created this route to allow users to log in with their credentials. It checks the password length,
    verifies the credentials against the database, and sets the user as online upon successful login.
    """
    if request.method == 'POST':
        username = request.form['username']
        password = request.form['password']

        # Validate password length (minimum 8 characters)
        if len(password) < 8:
            return render_template('login.html', error='Password must be at least 8 characters long')

        # Verify user credentials in the database
        with sqlite3.connect('database.db') as conn:
            cursor = conn.cursor()
            cursor.execute('SELECT password FROM users WHERE username = ?', (username,))
            result = cursor.fetchone()
            if result and result[0] == password:
                # Set session data for the logged-in user
                session['username'] = username
                session['is_logged_out'] = False
                session['is_online'] = True
                # Update the user's online status in the database
                cursor.execute('UPDATE users SET online = 1 WHERE username = ?', (username,))
                conn.commit()
                return redirect(url_for('index'))
        
        # Return error if credentials are invalid
        return render_template('login.html', error='Invalid username or password')
    
    # Render the login page for GET requests
    return render_template('login.html')

@app.route('/register', methods=['GET', 'POST'])
def register():
    """
    Handle user registration functionality.
    I developed this route to allow new users to register. It validates the password length and ensures
    the passwords match before creating a new user in the database.
    """
    if request.method == 'POST':
        username = request.form['username']
        password = request.form['password']
        confirm_password = request.form['confirm_password']

        # Validate password length (minimum 8 characters)
        if len(password) < 8:
            return render_template('register.html', error='Password must be at least 8 characters long')

        # Check if passwords match
        if password != confirm_password:
            return render_template('register.html', error='Passwords do not match')

        # Attempt to create a new user in the database
        with sqlite3.connect('database.db') as conn:
            cursor = conn.cursor()
            try:
                cursor.execute('INSERT INTO users (username, password, online) VALUES (?, ?, 0)', (username, password))
                conn.commit()
                # Set session data and mark the user as online
                session['username'] = username
                session['is_logged_out'] = False
                session['is_online'] = True
                cursor.execute('UPDATE users SET online = 1 WHERE username = ?', (username,))
                conn.commit()
                return redirect(url_for('index'))
            except sqlite3.IntegrityError:
                # Return error if the username already exists
                return render_template('register.html', error='Username already exists')
    
    # Render the registration page for GET requests
    return render_template('register.html')

@app.route('/logout')
def logout():
    """
    Handle user logout functionality.
    I implemented this route to log out the user, update their online status, and clear the session.
    """
    username = session.pop('username', None)
    if username:
        with sqlite3.connect('database.db') as conn:
            cursor = conn.cursor()
            # Set the user's online status to offline
            cursor.execute('UPDATE users SET online = 0 WHERE username = ?', (username,))
            # Remove user sessions
            cursor.execute('DELETE FROM sessions WHERE username = ?', (username,))
            conn.commit()
        # Notify other clients of the user's offline status
        socketio.emit('user_status', {'username': username, 'online': False})
        session['is_logged_out'] = True
        session['is_online'] = False
    
    # Clear the session and redirect to the login page
    session.clear()
    return redirect(url_for('login'))

# ------------------------- WebSocket Handlers -------------------------

@socketio.on('connect')
def handle_connect(auth=None):
    """
    Handle WebSocket connection events.
    I wrote this handler to manage user connections, updating their online status and notifying other clients.
    """
    if 'username' in session and not session.get('is_logged_out', False):
        username = session['username']
        with sqlite3.connect('database.db') as conn:
            cursor = conn.cursor()
            # Set the user as online
            cursor.execute('UPDATE users SET online = 1 WHERE username = ?', (username,))
            # Store the user's session ID
            cursor.execute('INSERT OR REPLACE INTO sessions (username, sid) VALUES (?, ?)', (username, request.sid))
            conn.commit()
        # Notify the client of the connection
        emit('status', {'msg': f'{username} connected'})
        # Broadcast the user's online status to all clients
        socketio.emit('user_status', {'username': username, 'online': True})

@socketio.on('disconnect')
def handle_disconnect(reason=None):
    """
    Handle WebSocket disconnection events.
    I created this handler to update the user's online status and notify other clients when a user disconnects.
    """
    if 'username' in session and not session.get('is_logged_out', False):
        username = session['username']
        with sqlite3.connect('database.db') as conn:
            cursor = conn.cursor()
            # Set the user as offline
            cursor.execute('UPDATE users SET online = 0 WHERE username = ?', (username,))
            # Remove the user's session
            cursor.execute('DELETE FROM sessions WHERE username = ? AND sid = ?', (username, request.sid))
            conn.commit()
        # Broadcast the user's offline status to all clients
        socketio.emit('user_status', {'username': username, 'online': False})

@socketio.on('join')
def on_join(data):
    """
    Handle joining a chat channel.
    I implemented this handler to allow users to join a channel and load its message history.
    """
    channel = data['channel']
    join_room(channel)
    with sqlite3.connect('database.db') as conn:
        cursor = conn.cursor()
        # Fetch message history for the channel
        cursor.execute('SELECT username, message, timestamp FROM messages WHERE channel = ? ORDER BY timestamp', (channel,))
        messages = [{'username': row[0], 'message': row[1], 'timestamp': row[2]} for row in cursor.fetchall()]
    # Send the message history to the client
    emit('load_messages', messages, room=channel)

@socketio.on('leave')
def on_leave(data):
    """
    Handle leaving a chat channel.
    I wrote this handler to allow users to leave a channel.
    """
    channel = data['channel']
    leave_room(channel)

@socketio.on('message')
def handle_message(data):
    """
    Handle sending a new message in a channel.
    I developed this handler to save messages to the database and broadcast them to all users in the channel.
    """
    channel = data['channel']
    username = session['username']
    message = data['message']
    with sqlite3.connect('database.db') as conn:
        cursor = conn.cursor()
        # Save the message to the database
        cursor.execute('INSERT INTO messages (channel, username, message) VALUES (?, ?, ?)', (channel, username, message))
        conn.commit()
    # Broadcast the new message to all users in the channel
    emit('new_message', {'username': username, 'message': message, 'channel': channel}, room=channel)

@socketio.on('refresh')
def handle_refresh():
    """
    Handle page refresh events.
    I created this handler to ensure the user's online status is updated when they refresh the page.
    """
    if 'username' in session and not session.get('is_logged_out', False):
        username = session['username']
        with sqlite3.connect('database.db') as conn:
            cursor = conn.cursor()
            # Set the user as online
            cursor.execute('UPDATE users SET online = 1 WHERE username = ?', (username,))
            # Update the user's session ID
            cursor.execute('INSERT OR REPLACE INTO sessions (username, sid) VALUES (?, ?)', (username, request.sid))
            conn.commit()
        # Broadcast the user's online status
        emit('user_status', {'username': username, 'online': True})

@socketio.on('request_private_chat')
def handle_request_private_chat(data):
    """
    Handle requests for private chats.
    I implemented this handler to allow users to request a private chat with another user.
    """
    try:
        # Broadcast the private chat request to all clients
        emit('request_private_chat', data, broadcast=True)
        # Send a success response to the requesting client
        emit('request_response', {'success': True}, room=request.sid)
    except Exception as e:
        # Send an error response if the request fails
        emit('request_response', {'success': False, 'error': str(e)}, room=request.sid)

@socketio.on('accept_private_chat')
def handle_accept_private_chat(data):
    """
    Handle accepting a private chat request.
    I wrote this handler to create a private channel between two users and notify them to start the chat.
    """
    try:
        # Create a unique channel name for the private chat
        users = sorted([data['from'], data['to']])
        private_channel = f"{users[0]}_{users[1]}"

        # Add both users to the private channel
        with sqlite3.connect('database.db') as conn:
            cursor = conn.cursor()
            cursor.execute('SELECT sid FROM sessions WHERE username = ?', (data['from'],))
            from_sid = cursor.fetchone()
            cursor.execute('SELECT sid FROM sessions WHERE username = ?', (data['to'],))
            to_sid = cursor.fetchone()

            if from_sid:
                join_room(private_channel, sid=from_sid[0])
            if to_sid:
                join_room(private_channel, sid=to_sid[0])

        # Notify both users to start the private chat
        emit('start_private_chat', {
            'from': data['from'],
            'to': data['to'],
            'channel': private_channel
        }, room=private_channel)

        # Remove the request from both users' lists
        if from_sid:
            emit('remove_request', {'request': data['to']}, room=from_sid[0])
        if to_sid:
            emit('remove_request', {'request': data['from']}, room=to_sid[0])
    except Exception as e:
        # Send an error response if the acceptance fails
        emit('accept_response', {'success': False, 'error': str(e)}, room=request.sid)

@socketio.on('close_private_chat')
def handle_close_private_chat(data):
    """
    Handle closing a private chat.
    I developed this handler to notify the other user when a private chat is closed.
    """
    try:
        from_user = data['from']
        to_user = data['to']
        channel = data['channel']
        # Notify the other user to close the private chat
        emit('close_private_chat', {
            'from': from_user,
            'to': to_user,
            'channel': channel
        }, room=channel, skip_sid=request.sid)
    except Exception as e:
        pass  # Silently handle errors to avoid disrupting the application

# ------------------------- Main Execution -------------------------

if __name__ == '__main__':
    """
    Start the Flask-SocketIO server.
    I set debug=True for development purposes; it should be disabled in production.
    """
    socketio.run(app, debug=True)