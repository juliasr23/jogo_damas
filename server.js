// Importa os módulos necessários
const express = require('express');         // Framework para servidor web
const http = require('http');               // Módulo HTTP nativo do Node.js
const WebSocket = require('ws');            // Biblioteca para WebSockets
const path = require('path');               // Utilitário para manipulação de caminhos de arquivos

// Cria a aplicação express e o servidor HTTP
const app = express();
const server = http.createServer(app);

// Cria um servidor WebSocket ligado ao servidor HTTP
const wss = new WebSocket.Server({ server });

// Configura o Express para servir arquivos estáticos da pasta 'public'
app.use(express.static(path.join(__dirname, 'public')));

// Lista para armazenar os dois jogadores conectados
let players = [];

// Quando um novo cliente se conecta via WebSocket
wss.on('connection', function connection(ws) {
    // Verifica se já existem 2 jogadores conectados
    if (players.length >= 2) {
        // Se sim, envia uma mensagem de erro e fecha a conexão
        ws.send(JSON.stringify({ type: 'error', message: 'Jogo cheio' }));
        ws.close();
        return;
    }

    // Adiciona o novo jogador à lista
    players.push(ws);

    // Define o ID do jogador como 1 ou 2 (baseado na posição na lista)
    const playerId = players.indexOf(ws) + 1;

    // Envia uma mensagem de "init" com o ID do jogador no formato de texto simples
    ws.send(`init ${playerId}\n`);

    // Quando o servidor recebe uma mensagem de um cliente
    ws.on('message', function incoming(message) {
        console.log("Mensagem recebida:", message.toString());

        // Reenvia essa mensagem para todos os outros clientes (exceto quem enviou)
        wss.clients.forEach(client => {
            if (client !== ws && client.readyState === WebSocket.OPEN) {
                client.send(message.toString()); // Envia a mensagem como texto puro
            }
        });
    });

    // Quando um cliente se desconecta
    ws.on('close', () => {
        // Remove o jogador da lista
        players = players.filter(p => p !== ws);
    });
});

// A porta em que o servidor esta rodar
const PORT = 3000;

// Inicio do servidor e a URL no terminal
server.listen(PORT, () => {
    console.log(`Servidor rodando em http://localhost:${PORT}`);
});
