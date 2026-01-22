function winGame() {
    Telegram.WebApp.sendData("WIN");
    Telegram.WebApp.close();
}

function loseGame() {
    Telegram.WebApp.sendData("LOSE");
    Telegram.WebApp.close();
}
