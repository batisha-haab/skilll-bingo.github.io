const tasks = [
"7 × 8 = ?",
"15 + 27 = ?",
"Tap fast!",
"9 × 6 = ?",
"Memory test"
];


const grid = document.getElementById("grid");


for (let i = 0; i < 9; i++) {
const btn = document.createElement("button");
btn.innerText = tasks[i % tasks.length];
btn.onclick = () => {
const ans = prompt(btn.innerText);
if (ans) {
btn.disabled = true;
btn.style.background = "green";
}
};
grid.appendChild(btn);
}
