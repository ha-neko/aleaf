const canvas = document.getElementById('leafCanvas');
const ctx = canvas.getContext('2d');

canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

const leaves = [];
const maxLeaves = 50;
const colors = [
    'rgb(242,231,166)',
    'rgb(137,216,155)',
    'rgb(107,195,153)',
    'rgb(182,137,51)',
    'rgb(227,190,102)'
];

document.body.style.background = 'linear-gradient(135deg, rgb(242,231,166), rgb(137,216,155))';
document.body.style.color = 'rgb(107,195,153)';

document.querySelectorAll('.card').forEach(card => {
    card.style.background = 'rgba(227,190,102, 0.2)';
    card.style.boxShadow = '0 4px 30px rgba(182,137,51, 0.3)';
    card.style.color = 'rgb(107,195,153)';
});

class Leaf {
    constructor() {
        this.x = Math.random() * canvas.width;
        this.y = Math.random() * canvas.height;
        this.size = Math.random() * 15 + 10;
        this.speedY = (Math.random() * 1 + 0.5) * (window.innerWidth < 768 ? 2 : 1); // Faster on mobile
        this.speedX = Math.random() * 0.6 - 0.3; // Sideways drift
        this.angle = Math.random() * Math.PI * 2;
        this.angleSpeed = Math.random() * 0.02 - 0.01;

        // Assign a random color from the colors array
        this.color = colors[Math.floor(Math.random() * colors.length)];
    }

    update() {
        this.y += this.speedY;
        this.x += this.speedX;
        this.angle += this.angleSpeed;

        // Reset leaf position when it falls off the screen
        if (this.y > canvas.height) {
            this.y = -this.size;
            this.x = Math.random() * canvas.width;
        }
    }

    draw() {
        ctx.save();
        ctx.fillStyle = this.color; // Use the assigned random color
        ctx.translate(this.x, this.y);
        ctx.rotate(this.angle);
        ctx.beginPath();
        ctx.moveTo(0, -this.size / 2);
        ctx.bezierCurveTo(-this.size / 2, -this.size / 2, -this.size, this.size / 3, 0, this.size);
        ctx.bezierCurveTo(this.size, this.size / 3, this.size / 2, -this.size / 2, 0, -this.size / 2);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
    }
}

function generateLeaves() {
    for (let i = 0; i < maxLeaves; i++) {
        leaves.push(new Leaf());
    }
}

function animateLeaves() {
    ctx.clearRect(0, 0, canvas.width, canvas.height); // Clear the canvas
    leaves.forEach(leaf => {
        leaf.update(); // Update the leaf's position
        leaf.draw();   // Draw the leaf on the canvas
    });
    requestAnimationFrame(animateLeaves); // Continue the animation
}
generateLeaves();
animateLeaves();



// Set the date of birth
const birthDate = new Date("2008-12-06"); // Birthdate: 6 December 2008
const currentDate = new Date();

// Set the next birthday for the current year
const nextBirthday = new Date(currentDate.getFullYear(), 11, 6); // 6 December of the current year

// Calculate age
let age = currentDate.getFullYear() - birthDate.getFullYear();

// If today's date is before the birthday, subtract 1 year
if (currentDate < nextBirthday) {
  age -= 1;
}

// Dynamically fill the age span
document.getElementById("age").textContent = age;


// Function to set the canvas size
function setCanvasSize() {
    canvas.width = window.innerWidth;
    canvas.height = document.documentElement.scrollHeight; // Set height to the full scrollable height
}

// Call the function once to set the initial size
setCanvasSize();

// Prevent resizing the canvas on scroll
window.addEventListener("resize", () => {
    setCanvasSize(); // Resize only when the window size changes
});

let wasMobile = window.innerWidth < 769;

  window.addEventListener("resize", () => {
    const isNowDesktop = window.innerWidth >= 769;

    if (wasMobile && isNowDesktop) {
      // If we resized from mobile to desktop, scroll to top
      window.scrollTo({ top: 0, behavior: "smooth" });
    }

    wasMobile = window.innerWidth < 769;
  });

  
document.addEventListener('DOMContentLoaded', function() {
    const music = document.getElementById('backgroundMusic');
    const toggle = document.getElementById('musicToggle');
    let isPlaying = false;
    
    // Set volume (0.0 to 1.0)
    music.volume = 0.8; // 30% volume - adjust as needed
    
    // Function to start music
    const startMusic = () => {
        music.play().then(() => {
            isPlaying = true;
            toggle.textContent = '🔊';
            console.log('Music started');
        }).catch((error) => {
            console.log('Auto-play blocked:', error);
            toggle.textContent = '🔇';
        });
    };
    
    // Try to play immediately
    startMusic();
    
    // Enable music on first user interaction (required by most browsers)
    document.addEventListener('click', startMusic, { once: true });
    document.addEventListener('touchstart', startMusic, { once: true });
    
    // Toggle button functionality
    toggle.addEventListener('click', (e) => {
        e.stopPropagation(); // Prevent triggering the document click
        if (isPlaying && !music.paused) {
            music.pause();
            toggle.textContent = '🔇';
            isPlaying = false;
        } else {
            music.play().then(() => {
                toggle.textContent = '🔊';
                isPlaying = true;
            });
        }
    });
});