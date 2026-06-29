import os
import json
import shutil
import hashlib
import time
import subprocess
from http.server import SimpleHTTPRequestHandler, HTTPServer

PORT = 8000

# Store SHA-256 hash of "admin" to check password authorization securely
# To change the password, update this hash to the SHA-256 of your new password
ADMIN_PASSWORD_HASH = '8c6976e5b5410415bde908bd4dee15dfb167a9c873fc4bb8a81f6f2ab448a918'

# Simple state tracking for rate limiting (cooldown in seconds)
LAST_SAVE_TIME = 0
SAVE_COOLDOWN = 2.0

def git_push_changes():
    try:
        # Check if git repository is initialized
        if not os.path.exists('.git'):
            return False, "Git repository is not initialized. Please set up Git remote origin first."
        
        # Add index.html, assets, and styling if updated
        files_to_add = ["index.html", "style.css", "script.js"]
        if os.path.exists("assets") and os.path.isdir("assets"):
            files_to_add.append("assets/")
            
        subprocess.run(["git", "add"] + files_to_add, capture_output=True, text=True, check=True)
        
        # Check if there are staged changes
        status_res = subprocess.run(["git", "status", "--porcelain"], capture_output=True, text=True, check=True)
        has_local_changes = bool(status_res.stdout.strip())
        
        if has_local_changes:
            # Commit local changes first
            commit_msg = f"Auto-update portfolio - {time.strftime('%Y-%m-%d %H:%M:%S')}"
            subprocess.run(["git", "commit", "-m", commit_msg], capture_output=True, text=True, check=True)
        else:
            # Check if we are ahead of remote
            status_full = subprocess.run(["git", "status"], capture_output=True, text=True, check=True)
            if "Your branch is ahead of" not in status_full.stdout:
                return True, "No new changes to commit or push."
        
        # Pull latest changes from remote (using rebase to keep history clean)
        subprocess.run(["git", "pull", "--rebase"], capture_output=True, text=True, check=True)
        
        # Push to remote branch
        subprocess.run(["git", "push"], capture_output=True, text=True, check=True)
        return True, "Changes committed, pulled remote changes, and pushed to GitHub successfully!"
    except subprocess.CalledProcessError as e:
        err_msg = e.stderr or e.stdout or "Command failed"
        print(f"Git command failed: {err_msg}")
        return False, f"Git operation failed: {err_msg.strip()}"
    except Exception as e:
        print(f"Git auto-push error: {str(e)}")
        return False, f"Git error: {str(e)}"


class PortfolioAdminHandler(SimpleHTTPRequestHandler):
    def send_security_headers(self):
        # Prevent content sniffing and cross-origin security issues
        self.send_header('X-Content-Type-Options', 'nosniff')
        self.send_header('X-Frame-Options', 'DENY')
        self.send_header('X-XSS-Protection', '1; mode=block')
        self.send_header('Referrer-Policy', 'strict-origin-when-cross-origin')

    def end_headers(self):
        self.send_security_headers()
        super().end_headers()

    def do_POST(self):
        global LAST_SAVE_TIME
        
        # 1. CSRF Mitigation: Verify request origin
        origin = self.headers.get('Origin')
        referer = self.headers.get('Referer')
        
        allowed_origins = [f'http://localhost:{PORT}', f'http://127.0.0.1:{PORT}']
        is_valid_origin = any((origin and origin.startswith(o)) or (referer and referer.startswith(o)) for o in allowed_origins)
        
        if not is_valid_origin:
            self.send_response(403)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({'status': 'error', 'message': 'Forbidden: CORS origin check failed.'}).encode('utf-8'))
            return

        # 2. Password Authentication: Check password hash in X-Admin-Password header
        admin_password = self.headers.get('X-Admin-Password', '')
        hashed_pass = hashlib.sha256(admin_password.encode('utf-8')).hexdigest()
        
        if hashed_pass != ADMIN_PASSWORD_HASH:
            self.send_response(401)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({'status': 'error', 'message': 'Unauthorized: Invalid password.'}).encode('utf-8'))
            return

        if self.path == '/api/save':
            # Rate Limiting: Limit POST requests frequency
            current_time = time.time()
            if current_time - LAST_SAVE_TIME < SAVE_COOLDOWN:
                self.send_response(429)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({'status': 'error', 'message': 'Too many requests. Please wait before saving again.'}).encode('utf-8'))
                return

            try:
                # Read content length
                content_length = int(self.headers['Content-Length'])
                post_data = self.rfile.read(content_length)
                
                # Parse JSON payload
                data = json.loads(post_data.decode('utf-8'))
                html_content = data.get('html')
                
                if html_content:
                    filepath = os.path.join(os.getcwd(), 'index.html')
                    
                    # Backup: Copy existing index.html before overwriting
                    if os.path.exists(filepath):
                        shutil.copyfile(filepath, filepath + '.bak')
                    
                    # Write the cleaned HTML back to index.html
                    with open(filepath, 'w', encoding='utf-8') as f:
                        f.write(html_content)
                    
                    # Update last save time
                    LAST_SAVE_TIME = current_time
                    
                    # Auto-push to Git
                    git_success, git_msg = git_push_changes()
                    
                    # Respond with success
                    self.send_response(200)
                    self.send_header('Content-Type', 'application/json')
                    self.end_headers()
                    
                    msg = 'Changes saved to disk and backup created successfully!'
                    if git_success:
                        msg += f'\n🚀 Git: {git_msg}'
                    else:
                        msg += f'\n⚠️ Git Info: {git_msg}'
                        
                    response = {'status': 'success', 'message': msg}
                    self.wfile.write(json.dumps(response).encode('utf-8'))
                else:
                    self.send_response(400)
                    self.send_header('Content-Type', 'application/json')
                    self.end_headers()
                    self.wfile.write(json.dumps({'status': 'error', 'message': "Missing 'html' content."}).encode('utf-8'))
            except Exception as e:
                self.send_response(500)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({'status': 'error', 'message': f'Server error: {str(e)}'}).encode('utf-8'))
                
        elif self.path == '/api/upload':
            try:
                import base64
                content_length = int(self.headers['Content-Length'])
                post_data = self.rfile.read(content_length)
                data = json.loads(post_data.decode('utf-8'))
                
                filename = data.get('filename', 'upload.png')
                base64_str = data.get('base64', '')
                
                # Secure filename against directory traversal
                safe_filename = os.path.basename(filename)
                # Generate unique filename using timestamp
                timestamp = int(time.time())
                unique_filename = f"project_{timestamp}_{safe_filename}"
                
                # Create assets directory if not exists
                assets_dir = os.path.join(os.getcwd(), 'assets')
                if not os.path.exists(assets_dir):
                    os.makedirs(assets_dir)
                
                # Decode base64
                if ',' in base64_str:
                    header, base64_str = base64_str.split(',', 1)
                
                image_bytes = base64.b64decode(base64_str)
                filepath = os.path.join(assets_dir, unique_filename)
                
                with open(filepath, 'wb') as f:
                    f.write(image_bytes)
                
                # Relative URL to serve
                image_url = f"assets/{unique_filename}"
                
                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({'status': 'success', 'imagePath': image_url}).encode('utf-8'))
                
            except Exception as e:
                self.send_response(500)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({'status': 'error', 'message': f'Upload failed: {str(e)}'}).encode('utf-8'))
        else:
            self.send_error(404, "Endpoint not found.")

    def do_OPTIONS(self):
        # Support CORS preflight
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, X-Admin-Password')
        self.end_headers()

# Set working directory to the directory of this file
os.chdir(os.path.dirname(os.path.abspath(__file__)))

print(f"Starting Secure Portfolio Admin Local Server on http://localhost:{PORT}")
print("To use the control panel and save changes automatically, keep this script running.")
print("To open control panel, visit http://localhost:8000/ and click the lock icon in the footer.")

try:
    server = HTTPServer(('0.0.0.0', PORT), PortfolioAdminHandler)
    server.serve_forever()
except KeyboardInterrupt:
    print("\nShutting down server...")
    server.server_close()

