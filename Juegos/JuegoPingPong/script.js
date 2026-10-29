const canvas = document.getElementById("game-canvas");
const ctx = canvas.getContext("2d");

canvas.width = 800;
canvas.height = 500;

const ball = {
    x: 400,
    y: 250,
    radius: 10,
    speedX: 5,
    speedY: 3
};

function drawBall() {
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
    ctx.fill();
}

function updateBall() {
    ball.x += ball.speedX;
    ball.y += ball.speedY;

    if (ball.y - ball.radius <= 0 || ball.y + ball.radius >= canvas.height) {
        ball.speedY = -ball.speedY;
    }
}


function gameLoop() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    updateBall();
    drawBall();

    requestAnimationFrame(gameLoop);
}

gameLoop();

