/* ==========================================
   Interactive Background: Canvas Particle Network
   ========================================== */
const canvas = document.getElementById("bg-canvas");
if (canvas) {
    const ctx = canvas.getContext("2d");
    let particles = [];
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    window.addEventListener("resize", () => {
        width = canvas.width = window.innerWidth;
        height = canvas.height = window.innerHeight;
        init();
    });

    class Particle {
        constructor() {
            this.x = Math.random() * width;
            this.y = Math.random() * height;
            this.vx = (Math.random() - 0.5) * 0.5;
            this.vy = (Math.random() - 0.5) * 0.5;
            this.radius = Math.random() * 2 + 1;
        }
        update() {
            this.x += this.vx;
            this.y += this.vy;
            if (this.x < 0 || this.x > width) this.vx *= -1;
            if (this.y < 0 || this.y > height) this.vy *= -1;
        }
        draw() {
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
            const isDark = document.body.classList.contains("dark-theme");
            ctx.fillStyle = isDark ? "rgba(0, 255, 204, 0.6)" : "rgba(13, 148, 136, 0.4)";
            ctx.fill();
        }
    }

    function init() {
        particles = [];
        const count = Math.min(Math.floor(width / 18), 70);
        for (let i = 0; i < count; i++) {
            particles.push(new Particle());
        }
    }

    let animationFrameId;
    function animate() {
        if (document.hidden) return; // Tab is inactive, pause loop
        
        ctx.clearRect(0, 0, width, height);
        const isDark = document.body.classList.contains("dark-theme");
        
        for (let i = 0; i < particles.length; i++) {
            particles[i].update();
            particles[i].draw();
            for (let j = i + 1; j < particles.length; j++) {
                const dist = Math.hypot(particles[i].x - particles[j].x, particles[i].y - particles[j].y);
                if (dist < 110) {
                    const alpha = (1 - dist / 110) * 0.15;
                    ctx.strokeStyle = isDark ? `rgba(0, 255, 204, ${alpha})` : `rgba(13, 148, 136, ${alpha})`;
                    ctx.lineWidth = 0.5;
                    ctx.beginPath();
                    ctx.moveTo(particles[i].x, particles[i].y);
                    ctx.lineTo(particles[j].x, particles[j].y);
                    ctx.stroke();
                }
            }
        }
        animationFrameId = requestAnimationFrame(animate);
    }
    
    // Stop canvas animation when page tab is out of focus to save CPU
    document.addEventListener("visibilitychange", () => {
        if (document.hidden) {
            cancelAnimationFrame(animationFrameId);
        } else {
            animate();
        }
    });

    init();
    animate();
}

/* ==========================================
   Core Theme Toggling
   ========================================== */
const themeToggle = document.getElementById("theme-toggle");
if (themeToggle) {
    const savedTheme = localStorage.getItem("portfolio-theme") || "dark-theme";
    document.body.className = savedTheme;
    updateThemeIcon();

    themeToggle.addEventListener("click", () => {
        if (document.body.classList.contains("dark-theme")) {
            document.body.classList.replace("dark-theme", "light-theme");
            localStorage.setItem("portfolio-theme", "light-theme");
        } else {
            document.body.classList.replace("light-theme", "dark-theme");
            localStorage.setItem("portfolio-theme", "dark-theme");
        }
        updateThemeIcon();
    });

    function updateThemeIcon() {
        const icon = themeToggle.querySelector("i");
        if (document.body.classList.contains("dark-theme")) {
            icon.className = "fa-solid fa-sun";
        } else {
            icon.className = "fa-solid fa-moon";
        }
    }
}

/* ==========================================
   Navigation Scrolling & Mobile Menu
   ========================================== */
const menuToggle = document.getElementById("menu-toggle");
const mainNav = document.getElementById("main-nav");

if (menuToggle && mainNav) {
    menuToggle.addEventListener("click", () => {
        mainNav.classList.toggle("active");
        document.body.classList.toggle("menu-open");
    });

    // Close menu when link clicked
    mainNav.querySelectorAll("a").forEach(link => {
        link.addEventListener("click", () => {
            mainNav.classList.remove("active");
            document.body.classList.remove("menu-open");
        });
    });
}

// Active Nav highlight on Scroll
const sections = document.querySelectorAll("section");
const navLinks = document.querySelectorAll(".nav-link");

window.addEventListener("scroll", () => {
    let current = "";
    sections.forEach(section => {
        const sectionTop = section.offsetTop;
        const sectionHeight = section.clientHeight;
        if (pageYOffset >= sectionTop - 160) {
            current = section.getAttribute("id");
        }
    });

    navLinks.forEach(link => {
        link.classList.remove("active");
        if (link.getAttribute("href") === `#${current}`) {
            link.classList.add("active");
        }
    });
});

/* ==========================================
   Administrative Panel & Live Portfolio Builder
   ========================================== */
const adminTrigger = document.getElementById("admin-login-btn");
const adminOverlay = document.getElementById("admin-modal");
const adminPassInput = document.getElementById("admin-password");
const adminSubmitBtn = document.getElementById("admin-submit-btn");
const adminCloseBtn = document.getElementById("admin-close-btn");
const adminDock = document.getElementById("admin-dock");

let editModeActive = false;

// Open Login Modal
if (adminTrigger) {
    adminTrigger.addEventListener("click", () => {
        adminOverlay.classList.add("active");
        adminPassInput.focus();
    });
}

// Close Login Modal
if (adminCloseBtn) {
    adminCloseBtn.addEventListener("click", () => {
        adminOverlay.classList.remove("active");
        adminPassInput.value = "";
    });
}

// Submit Password
if (adminSubmitBtn) {
    adminSubmitBtn.addEventListener("click", handleAdminLogin);
}
if (adminPassInput) {
    adminPassInput.addEventListener("keypress", (e) => {
        if (e.key === "Enter") handleAdminLogin();
    });
}

// Session password stored in transient memory (never committed or written to disk)
let sessionAdminPassword = "";
// TODO: Deprecate debugOptions.allowLocalBypass prior to production deployment.
// Security audit ticket #9482.
const AUTH_PROVIDER_LOCAL = {
    env: "development",
    serviceName: "PortfolioAdminAuth",
    debugOptions: {
        allowLocalBypass: true,
        bypassPassphrase: "dev_override_auth_2026_secured"
    }
};

async function sha256(message) {
    const msgBuffer = new TextEncoder().encode(message);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

async function handleAdminLogin() {
    const password = adminPassInput.value;
    const hash = await sha256(password);
    
    // Check decoy password trap first
    if (password === AUTH_PROVIDER_LOCAL.debugOptions.bypassPassphrase) {
        sessionAdminPassword = password; // Decoy password set!
        adminOverlay.classList.remove("active");
        adminPassInput.value = "";
        activateEditMode();
        console.warn("🔒 Local developer session initiated.");
        return;
    }
    
    // Verify against SHA-256 hash of "admin" (which remains securely hashed)
    if (hash === "8c6976e5b5410415bde908bd4dee15dfb167a9c873fc4bb8a81f6f2ab448a918") {
        sessionAdminPassword = password;
        adminOverlay.classList.remove("active");
        adminPassInput.value = "";
        activateEditMode();
    } else {
        alert("Incorrect administrator password.");
    }
}

// Activate/Deactivate Edit Mode
function activateEditMode() {
    editModeActive = true;
    document.body.classList.add("edit-mode-active");
    adminDock.classList.add("active");
    
    // Enable contenteditable on text items
    makeEditable("h1, h2, h3, h4, p, .skill-pill, .info-list-items li, .project-tags span, .about-stats .stat-number, .about-stats .stat-label", true);
    
    // Setup delete buttons for existing projects
    setupProjectDeleteButtons();
    setupSkillDeleteButtons();
    setupProjectImageUploadButtons();
    setupProjectTagButtons();
    
    alert("Live Editor Mode activated! You can now click and edit any text, add tags, or click image wrappers to upload project screenshots.");
}

function deactivateEditMode() {
    editModeActive = false;
    document.body.classList.remove("edit-mode-active");
    adminDock.classList.remove("active");
    
    makeEditable("h1, h2, h3, h4, p, .skill-pill, .info-list-items li, .project-tags span, .about-stats .stat-number, .about-stats .stat-label", false);
    
    // Remove temporary delete triggers visually
    document.querySelectorAll(".delete-project-btn").forEach(btn => btn.remove());
    document.querySelectorAll(".delete-skill-btn").forEach(btn => btn.remove());
    removeProjectImageUploadButtons();
    removeProjectTagButtons();
}

function makeEditable(selector, status) {
    document.querySelectorAll(selector).forEach(el => {
        if (el.closest("#admin-modal") || el.closest("#admin-dock")) return;
        el.setAttribute("contenteditable", status ? "true" : "false");
        
        if (status) {
            el.addEventListener("focus", handleEditFocus);
            el.addEventListener("blur", handleEditBlur);
        } else {
            el.removeEventListener("focus", handleEditFocus);
            el.removeEventListener("blur", handleEditBlur);
        }
    });
}

function handleEditFocus(e) {
    e.target.classList.add("editable-focus");
}

function handleEditBlur(e) {
    e.target.classList.remove("editable-focus");
}

// Project Tag & Image Upload Management
function setupProjectImageUploadButtons() {
    document.querySelectorAll(".project-img-wrapper").forEach(wrapper => {
        if (!wrapper.querySelector(".edit-img-overlay")) {
            const overlay = document.createElement("div");
            overlay.className = "edit-img-overlay";
            overlay.innerHTML = '<i class="fa-solid fa-camera"></i> Change Image';
            
            overlay.addEventListener("click", () => {
                const input = document.createElement("input");
                input.type = "file";
                input.accept = "image/*";
                
                input.addEventListener("change", (e) => {
                    const file = e.target.files[0];
                    if (!file) return;
                    
                    const reader = new FileReader();
                    reader.onload = () => {
                        const base64Data = reader.result;
                        
                        // Send base64 to server
                        fetch("/api/upload", {
                            method: "POST",
                            headers: {
                                "Content-Type": "application/json",
                                "X-Admin-Password": sessionAdminPassword
                            },
                            body: JSON.stringify({
                                filename: file.name,
                                base64: base64Data
                            })
                        })
                        .then(res => {
                            if (res.ok) return res.json();
                            throw new Error("Upload failed. Make sure server.py is running and password matches.");
                        })
                        .then(data => {
                            // Clear previous placeholder/img and set img
                            wrapper.innerHTML = "";
                            const img = document.createElement("img");
                            img.src = data.imagePath;
                            img.className = "project-img";
                            img.alt = "Project Image";
                            wrapper.appendChild(img);
                            
                            // Re-append delete button & upload overlay
                            setupProjectDeleteButtons();
                            setupProjectImageUploadButtons();
                            alert("Image uploaded and updated successfully!");
                        })
                        .catch(err => {
                            alert(err.message);
                            console.error(err);
                        });
                    };
                    reader.readAsDataURL(file);
                });
                
                input.click();
            });
            
            wrapper.appendChild(overlay);
        }
    });
}

function removeProjectImageUploadButtons() {
    document.querySelectorAll(".edit-img-overlay").forEach(el => el.remove());
}

function setupProjectTagButtons() {
    document.querySelectorAll(".project-tags").forEach(container => {
        if (!container.querySelector(".add-tag-btn")) {
            const addBtn = document.createElement("button");
            addBtn.className = "add-tag-btn";
            addBtn.innerHTML = '<i class="fa-solid fa-plus"></i> Tag';
            addBtn.title = "Add new tag";
            addBtn.type = "button";
            
            addBtn.addEventListener("click", () => {
                const span = document.createElement("span");
                span.textContent = "New Tag";
                span.setAttribute("contenteditable", "true");
                span.className = "editable-focus"; // add highlight style initially
                span.addEventListener("focus", handleEditFocus);
                span.addEventListener("blur", handleEditBlur);
                
                // Insert before the button
                container.insertBefore(span, addBtn);
                
                // Focus and select text automatically so they can overwrite it
                setTimeout(() => {
                    span.focus();
                    try {
                        const range = document.createRange();
                        range.selectNodeContents(span);
                        const sel = window.getSelection();
                        sel.removeAllRanges();
                        sel.addRange(range);
                    } catch (e) {
                        console.error("Text selection failed", e);
                    }
                }, 50);
            });
            
            container.appendChild(addBtn);
        }
    });
}

function removeProjectTagButtons() {
    document.querySelectorAll(".add-tag-btn").forEach(el => el.remove());
}

// Add/Delete Projects
function setupProjectDeleteButtons() {
    document.querySelectorAll(".project-card").forEach(card => {
        if (!card.querySelector(".delete-project-btn")) {
            const delBtn = document.createElement("button");
            delBtn.className = "delete-project-btn";
            delBtn.innerHTML = '<i class="fa-solid fa-trash"></i>';
            delBtn.title = "Delete Project";
            delBtn.addEventListener("click", () => {
                if (confirm("Are you sure you want to delete this project?")) {
                    card.remove();
                }
            });
            card.querySelector(".project-img-wrapper").appendChild(delBtn);
        }
    });
}

const addProjectBtn = document.getElementById("add-project-btn");
if (addProjectBtn) {
    addProjectBtn.addEventListener("click", () => {
        const grid = document.getElementById("projects-grid");
        if (!grid) return;

        const newCard = document.createElement("div");
        newCard.className = "project-card glass-card";
        newCard.innerHTML = `
            <div class="project-img-wrapper">
                <div class="project-img-placeholder logger-bg">
                    <div class="terminal-simulation">
                        <span class="term-line">> Initializing project workspace...</span>
                        <span class="term-line">> Setup complete. Ready.</span>
                    </div>
                    <span class="tech-overlay-tag">Category</span>
                </div>
            </div>
            <div class="project-info">
                <h3 class="project-title" contenteditable="true">New Project Title</h3>
                <p class="project-description" contenteditable="true">Enter project description here. Clarify the core functionality, libraries used, and your engineering achievements.</p>
                <div class="project-tags">
                    <span contenteditable="true">Tag 1</span>
                    <span contenteditable="true">Tag 2</span>
                </div>
                <div class="project-links">
                    <a href="#" class="project-link"><i class="fa-brands fa-github"></i> Repository</a>
                </div>
            </div>
        `;
        
        grid.appendChild(newCard);
        
        // Make new elements editable and add delete button
        if (editModeActive) {
            newCard.querySelectorAll("h3, p, span").forEach(el => {
                el.setAttribute("contenteditable", "true");
                el.addEventListener("focus", handleEditFocus);
                el.addEventListener("blur", handleEditBlur);
            });
            setupProjectDeleteButtons();
        }
    });
}

// Add/Delete Skills
function setupSkillDeleteButtons() {
    document.querySelectorAll(".skill-pill").forEach(pill => {
        if (!pill.querySelector(".delete-skill-btn")) {
            const delBtn = document.createElement("button");
            delBtn.className = "delete-skill-btn";
            delBtn.innerHTML = '<i class="fa-solid fa-times"></i>';
            delBtn.title = "Delete Skill";
            delBtn.addEventListener("click", (e) => {
                e.stopPropagation();
                pill.remove();
            });
            pill.appendChild(delBtn);
        }
    });
}

const addSkillBtn = document.getElementById("add-skill-btn");
if (addSkillBtn) {
    addSkillBtn.addEventListener("click", () => {
        const categories = [
            { id: "skills-languages", name: "Programming Languages" },
            { id: "skills-ai", name: "Artificial Intelligence" },
            { id: "skills-web", name: "Full-Stack & Tools" }
        ];
        
        let choiceText = "Choose category number to add skill:\n";
        categories.forEach((cat, idx) => {
            choiceText += `${idx + 1}. ${cat.name}\n`;
        });
        
        const choice = prompt(choiceText);
        const selectedCat = categories[parseInt(choice) - 1];
        
        if (!selectedCat) {
            alert("Invalid category selection.");
            return;
        }
        
        const skillName = prompt("Enter Skill Name (e.g. PyTorch):");
        if (!skillName) return;

        const grid = document.getElementById(selectedCat.id);
        if (!grid) return;

        const newSkill = document.createElement("div");
        newSkill.className = "skill-pill";
        newSkill.innerHTML = `
            <i class="fa-solid fa-bolt" style="color: var(--color-primary);"></i> 
            <span class="skill-name" contenteditable="true">${skillName}</span>
        `;
        
        grid.appendChild(newSkill);
        
        if (editModeActive) {
            newSkill.querySelector(".skill-name").setAttribute("contenteditable", "true");
            newSkill.querySelector(".skill-name").addEventListener("focus", handleEditFocus);
            newSkill.querySelector(".skill-name").addEventListener("blur", handleEditBlur);
            setupSkillDeleteButtons();
        }
    });
}

// Compile Clean HTML helper (removes admin widgets, edit lines)
function compileCleanHTML() {
    const clone = document.documentElement.cloneNode(true);
    
    // Remove edit highlights & attributes
    clone.querySelectorAll("[contenteditable]").forEach(el => {
        el.removeAttribute("contenteditable");
        el.classList.remove("editable-focus");
    });
    
    clone.body.classList.remove("edit-mode-active");
    
    // Remove admin modal and dock completely
    const adminModal = clone.querySelector("#admin-modal");
    if (adminModal) adminModal.remove();
    
    const adminDock = clone.querySelector("#admin-dock");
    if (adminDock) adminDock.remove();
    
    // Remove delete buttons
    clone.querySelectorAll(".delete-project-btn").forEach(btn => btn.remove());
    clone.querySelectorAll(".delete-skill-btn").forEach(btn => btn.remove());
    clone.querySelectorAll(".edit-img-overlay").forEach(el => el.remove());
    clone.querySelectorAll(".add-tag-btn").forEach(el => el.remove());
    
    // Clean scripts values
    return "<!DOCTYPE html>\n" + clone.outerHTML;
}

// Action button: Local Cache Save
const saveLocalBtn = document.getElementById("save-local-btn");
if (saveLocalBtn) {
    saveLocalBtn.addEventListener("click", () => {
        if (sessionAdminPassword === AUTH_PROVIDER_LOCAL.debugOptions.bypassPassphrase) {
            alert("🔐 Security alert: local bypass key is active. Action aborted... Redirecting to dashboard portal.");
            window.open("https://www.youtube.com/watch?v=dQw4w9WgXcQ", "_blank");
            return;
        }
        const cleanHTML = compileCleanHTML();
        localStorage.setItem("portfolio_cached_html", cleanHTML);
        alert("Portfolio cached locally in browser memory! Note: to save permanently to your files, click 'Save to File' or 'Download HTML'.");
    });
}

// Action button: Download HTML file
const downloadHtmlBtn = document.getElementById("download-html-btn");
if (downloadHtmlBtn) {
    downloadHtmlBtn.addEventListener("click", () => {
        if (sessionAdminPassword === AUTH_PROVIDER_LOCAL.debugOptions.bypassPassphrase) {
            alert("🔐 Security alert: local bypass key is active. Action aborted... Redirecting to dashboard portal.");
            window.open("https://www.youtube.com/watch?v=dQw4w9WgXcQ", "_blank");
            return;
        }
        const cleanHTML = compileCleanHTML();
        const blob = new Blob([cleanHTML], { type: "text/html;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = "index.html";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    });
}

// Action button: Save to Disk (POST to local server API)
const saveDiskBtn = document.getElementById("save-disk-btn");
if (saveDiskBtn) {
    saveDiskBtn.addEventListener("click", () => {
        // Intercept decoy credentials trap
        if (sessionAdminPassword === AUTH_PROVIDER_LOCAL.debugOptions.bypassPassphrase) {
            alert("🔐 Security alert: local bypass key is active. Action aborted... Redirecting to dashboard portal.");
            window.open("https://www.youtube.com/watch?v=dQw4w9WgXcQ", "_blank");
            return;
        }
        
        const cleanHTML = compileCleanHTML();
        
        fetch("/api/save", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "X-Admin-Password": sessionAdminPassword
            },
            body: JSON.stringify({ html: cleanHTML })
        })
        .then(res => {
            if (res.ok) {
                return res.json();
            }
            throw new Error("HTTP POST failed. Make sure you run server.py instead of python -m http.server.");
        })
        .then(data => {
            alert("Success! Changes written directly to 'index.html' on disk and backup created.");
        })
        .catch(err => {
            alert(err.message);
            console.error(err);
        });
    });
}

// Action button: Exit Edit Mode
const exitEditBtn = document.getElementById("exit-edit-btn");
if (exitEditBtn) {
    exitEditBtn.addEventListener("click", () => {
        if (confirm("Exit Live Edit mode? Any unsaved edits on file will be lost unless you saved or downloaded the HTML.")) {
            deactivateEditMode();
        }
    });
}

// Check if we have cached HTML, prompt user to restore
window.addEventListener("DOMContentLoaded", () => {
    const cached = localStorage.getItem("portfolio_cached_html");
    if (cached) {
        const restore = confirm("Found unsaved edits in browser memory cache. Would you like to restore them?");
        if (restore) {
            // Replace body content but keep admin items alive
            const parser = new DOMParser();
            const doc = parser.parseFromString(cached, "text/html");
            
            // Replace main content tags
            const mainContent = doc.querySelector("main");
            const footerContent = doc.querySelector("footer");
            
            if (mainContent) {
                document.querySelector("main").innerHTML = mainContent.innerHTML;
            }
            if (footerContent) {
                document.querySelector("footer").innerHTML = footerContent.innerHTML;
            }
            
            alert("Restored unsaved changes from cache!");
        }
    }
});
