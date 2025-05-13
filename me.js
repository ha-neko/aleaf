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
        this.speedY = Math.random() * 1 + 0.5;
        this.speedX = Math.random() * 0.6 - 0.3; // Sideways drift
        this.angle = Math.random() * Math.PI * 2;
        this.angleSpeed = Math.random() * 0.02 - 0.01;
        this.color = colors[Math.floor(Math.random() * colors.length)];
        this.opacity = Math.random() * 0.5 + 0.5;
    }

    draw() {
        ctx.save();
        ctx.globalAlpha = this.opacity;
        ctx.fillStyle = this.color;
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

    update() {
        this.y += this.speedY;
        this.x += this.speedX;
        this.angle += this.angleSpeed;

        if (this.y > canvas.height) {
            this.y = 0 - this.size;
            this.x = Math.random() * canvas.width;
        }
        this.draw();
    }
}

function generateLeaves() {
    for (let i = 0; i < maxLeaves; i++) {
        leaves.push(new Leaf());
    }
}

function animateLeaves() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    leaves.forEach(leaf => leaf.update());
    requestAnimationFrame(animateLeaves);
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

window.addEventListener("resize", () => {
    // Check if the canvas dimensions have actually changed
    if (canvas.width !== window.innerWidth || canvas.height !== window.innerHeight) {
        // Update the canvas size
        const oldWidth = canvas.width;
        const oldHeight = canvas.height;
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;

        // Adjust the positions of the leaves proportionally
        leaves.forEach(leaf => {
            leaf.x = (leaf.x / oldWidth) * canvas.width;
            leaf.y = (leaf.y / oldHeight) * canvas.height;
        });
    }
});
function resizeCanvasToPage() {
    // Set canvas width to the viewport width
    canvas.width = window.innerWidth;

    // Set canvas height to the full scrollable height of the document
    canvas.height = Math.max(
        document.documentElement.scrollHeight,
        document.body.scrollHeight
    );
}

// Call the function initially and on window resize
resizeCanvasToPage();
window.addEventListener("resize", resizeCanvasToPage);
