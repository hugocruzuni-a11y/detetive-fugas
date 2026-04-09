document.getElementById('btnAnalisar').addEventListener('click', async () => {
    const texto = document.getElementById('extratoInput').value;
    const btnTexto = document.getElementById('btnTexto');
    const loadingIcon = document.getElementById('loadingIcon');
    const areaResultados = document.getElementById('areaResultados');
    
    if (!texto.trim()) {
        alert("Por favor, cola o texto do teu extrato bancário primeiro.");
        return;
    }

    // Modo "A pensar..."
    btnTexto.innerText = "A investigar fugas...";
    loadingIcon.classList.remove('hidden');
    areaResultados.classList.add('hidden');

    try {
        // Enviar para o nosso motor backend
        const resposta = await fetch('/api/analisar-extrato', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ texto: texto })
        });

        const resultado = await resposta.json();

        if (resultado.sucesso) {
            // Mostrar os valores
            document.getElementById('valorAnual').innerText = resultado.dados.total_desperdicado_anual + '€';
            document.getElementById('mensagemImpacto').innerText = resultado.dados.mensagem_impacto;

            // Limpar a lista anterior
            const lista = document.getElementById('listaSubscricoes');
            lista.innerHTML = '';

            // Criar um cartão para cada subscrição encontrada
            resultado.dados.subscricoes_encontradas.forEach(sub => {
                const item = document.createElement('div');
                item.className = "bg-white p-4 rounded-xl shadow-sm border border-slate-100 flex justify-between items-center";
                item.innerHTML = `
                    <div>
                        <p class="font-bold text-slate-800">${sub.nome}</p>
                        <p class="text-xs text-slate-500">${sub.categoria}</p>
                    </div>
                    <div class="text-right">
                        <p class="font-bold text-rose-600">${sub.valor_mensal}€ <span class="text-xs font-normal text-slate-400">/mês</span></p>
                    </div>
                `;
                lista.appendChild(item);
            });

            // Revelar a área de resultados
            areaResultados.classList.remove('hidden');
        } else {
            alert("A IA teve um pequeno soluço. Tenta novamente!");
        }

    } catch (erro) {
        console.error(erro);
        alert("Erro de ligação. O motor está ligado no VS Code?");
    } finally {
        // Voltar o botão ao normal
        btnTexto.innerText = "Analisar o meu Extrato Agora";
        loadingIcon.classList.add('hidden');
    }
});