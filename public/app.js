const dropzone = document.getElementById('dropzone');
const fileInput = document.getElementById('fileInput');
const dropzoneText = document.getElementById('dropzoneText');
const btnAnalisar = document.getElementById('btnAnalisar');
let ficheiroSelecionado = null;

// 1. Clicar na dropzone abre a janela do computador
dropzone.addEventListener('click', () => fileInput.click());

// 2. Efeitos visuais ao arrastar por cima
dropzone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropzone.classList.add('border-emerald-500', 'bg-emerald-50');
});
dropzone.addEventListener('dragleave', () => {
    dropzone.classList.remove('border-emerald-500', 'bg-emerald-50');
});

// 3. Quando o utilizador larga o ficheiro
dropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropzone.classList.remove('border-emerald-500', 'bg-emerald-50');
    
    if (e.dataTransfer.files.length > 0) {
        ficheiroSelecionado = e.dataTransfer.files[0];
        mostrarFicheiroPronto();
    }
});

// 4. Quando o utilizador seleciona pelo clique
fileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
        ficheiroSelecionado = e.target.files[0];
        mostrarFicheiroPronto();
    }
});

function mostrarFicheiroPronto() {
    if (ficheiroSelecionado.type !== "application/pdf") {
        alert("Por favor, carrega apenas ficheiros PDF.");
        ficheiroSelecionado = null;
        return;
    }
    dropzoneText.innerHTML = `<span class="text-emerald-600 font-bold">📄 ${ficheiroSelecionado.name} carregado com sucesso!</span>`;
    btnAnalisar.classList.remove('hidden'); // Mostra o botão
}

// 5. Enviar para a IA
btnAnalisar.addEventListener('click', async () => {
    if (!ficheiroSelecionado) return;

    const btnTexto = document.getElementById('btnTexto');
    const loadingIcon = document.getElementById('loadingIcon');
    const areaResultados = document.getElementById('areaResultados');
    
    // Modo "A pensar..."
    btnTexto.innerText = "A ler PDF e procurar fugas...";
    loadingIcon.classList.remove('hidden');
    areaResultados.classList.add('hidden');

    // Preparar o ficheiro para envio (FormData)
    const formData = new FormData();
    formData.append('extrato', ficheiroSelecionado);

    try {
        const resposta = await fetch('/api/analisar-pdf', {
            method: 'POST',
            body: formData // Não precisamos de headers com FormData
        });

        const resultado = await resposta.json();

        if (resultado.sucesso) {
            document.getElementById('valorAnual').innerText = resultado.dados.total_desperdicado_anual + '€';
            document.getElementById('mensagemImpacto').innerText = resultado.dados.mensagem_impacto;

            const lista = document.getElementById('listaSubscricoes');
            lista.innerHTML = '';

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

            areaResultados.classList.remove('hidden');
        } else {
            alert("A IA teve um pequeno soluço. Tenta novamente!");
        }

    } catch (erro) {
        console.error(erro);
        alert("Erro de ligação.");
    } finally {
        btnTexto.innerText = "Analisar o meu Extrato Agora";
        loadingIcon.classList.add('hidden');
    }
});