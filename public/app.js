const dropzone = document.getElementById('dropzone');
const fileInput = document.getElementById('fileInput');
const dropzoneText = document.getElementById('dropzoneText');
const btnAnalisar = document.getElementById('btnAnalisar');
let ficheiroSelecionado = null;

function mostrarToast(mensagem, tipo = 'erro') {
    const toast = document.getElementById('toast');
    const toastMsg = document.getElementById('toastMsg');
    const toastIcon = document.getElementById('toastIcon');
    if(!toast) return alert(mensagem);

    toastMsg.innerText = mensagem;
    toastIcon.innerText = tipo === 'erro' ? '⚠️' : '✅';
    toast.classList.remove('opacity-0', '-translate-y-10');
    setTimeout(() => { toast.classList.add('opacity-0', '-translate-y-10'); }, 5000);
}

dropzone.addEventListener('click', () => fileInput.click());

['dragenter', 'dragover'].forEach(eventName => {
    dropzone.addEventListener(eventName, (e) => {
        e.preventDefault();
        dropzone.classList.add('border-emerald-400', 'bg-white/90', 'scale-[1.02]', 'shadow-2xl');
    });
});

['dragleave', 'drop'].forEach(eventName => {
    dropzone.addEventListener(eventName, (e) => {
        e.preventDefault();
        dropzone.classList.remove('border-emerald-400', 'bg-white/90', 'scale-[1.02]', 'shadow-2xl');
    });
});

dropzone.addEventListener('drop', (e) => {
    if (e.dataTransfer.files.length > 0) {
        ficheiroSelecionado = e.dataTransfer.files[0];
        mostrarFicheiroPronto();
    }
});

fileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
        ficheiroSelecionado = e.target.files[0];
        mostrarFicheiroPronto();
    }
});

function mostrarFicheiroPronto() {
    if (ficheiroSelecionado.type !== "application/pdf") {
        mostrarToast("Ficheiro inválido. Por favor, insere um documento PDF.", "erro");
        ficheiroSelecionado = null;
        return;
    }
    dropzone.classList.add('border-emerald-500', 'bg-emerald-50/50');
    dropzoneText.innerHTML = `<span class="text-emerald-800 font-black text-xl tracking-tight">PDF Carregado com Sucesso</span>`;
    document.getElementById('dropzoneSub').innerText = ficheiroSelecionado.name;
    document.getElementById('dropzoneIcon').classList.add('text-emerald-600');
    document.getElementById('dropzoneIcon').innerHTML = `<svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>`;
    
    btnAnalisar.classList.remove('hidden');
    btnAnalisar.classList.add('animate-pulse-slow');
}

btnAnalisar.addEventListener('click', async () => {
    if (!ficheiroSelecionado) return;

    const areaResultados = document.getElementById('areaResultados');
    const loadingStatus = document.getElementById('loadingStatus');
    const progressBar = document.getElementById('progressBar');
    const loadingText = document.getElementById('loadingText');
    const loadingPercent = document.getElementById('loadingPercent');

    btnAnalisar.classList.add('hidden');
    dropzone.classList.add('hidden');
    loadingStatus.classList.remove('hidden');
    areaResultados.classList.add('hidden');

    const frasesCarregamento = [
        "A encriptar ligação ao motor neural...", 
        "A analisar estrutura criptográfica do extrato...", 
        "A cruzar movimentos com a matriz de comissões europeias...", 
        "A isolar subscrições ocultas e taxas predatórias...", 
        "A calcular mapa de reembolso e preparar minutas..."
    ];
    let fraseIndex = 0; let progresso = 0;
    
    const progressInterval = setInterval(() => {
        if (progresso < 94) {
            progresso += Math.random() * 4;
            if(progresso > 94) progresso = 94;
            progressBar.style.width = `${progresso}%`;
            loadingPercent.innerText = `${Math.floor(progresso)}%`;
        }
    }, 250);

    const textInterval = setInterval(() => {
        loadingText.innerText = frasesCarregamento[fraseIndex];
        fraseIndex = (fraseIndex + 1) % frasesCarregamento.length;
    }, 2200);

    const formData = new FormData();
    formData.append('extrato', ficheiroSelecionado);

    try {
        const resposta = await fetch('/api/analisar-pdf', { method: 'POST', body: formData });
        const resultado = await resposta.json();
        
        clearInterval(textInterval); clearInterval(progressInterval);

        if (resultado.sucesso) {
            progressBar.style.width = '100%';
            loadingPercent.innerText = '100%';
            loadingText.innerText = 'Auditoria Forense Concluída!';
            
            setTimeout(() => {
                loadingStatus.classList.add('hidden'); 
                document.getElementById('areaUpload').classList.add('hidden'); 
                areaResultados.classList.remove('hidden'); 
                
                const valObj = document.getElementById('valorAnual');
                const total = resultado.dados.total_desperdicado_anual || 0;
                let startTimestamp = null;
                const duration = 2500; 

                const step = (timestamp) => {
                    if (!startTimestamp) startTimestamp = timestamp;
                    const progress = Math.min((timestamp - startTimestamp) / duration, 1);
                    const easeOut = 1 - Math.pow(1 - progress, 4); // Efeito desaceleração dramática
                    valObj.innerText = Math.floor(easeOut * total).toLocaleString('pt-PT');
                    if (progress < 1) window.requestAnimationFrame(step);
                    else valObj.innerText = total.toLocaleString('pt-PT'); 
                };
                window.requestAnimationFrame(step);

                document.getElementById('mensagemImpacto').innerText = `"${resultado.dados.mensagem_impacto || 'Auditoria concluída com sucesso.'}"`;

                const lista = document.getElementById('listaSubscricoes');
                lista.innerHTML = '';

                let subscricoes = resultado.dados.subscricoes_encontradas || [];
                subscricoes.sort((a, b) => parseFloat(b.valor_mensal) - parseFloat(a.valor_mensal));

                const freeCount = subscricoes.length > 2 ? 2 : (subscricoes.length > 0 ? 1 : 0);

                if (subscricoes.length === 0) {
                    lista.innerHTML = `<div class="text-center p-8 text-emerald-700 font-bold bg-emerald-50 border border-emerald-200 rounded-[1.5rem] shadow-sm">Parabéns! A tua conta bancária está impecável e sem fugas detetadas.</div>`;
                    document.getElementById('paywall').classList.add('hidden');
                }

                subscricoes.forEach((sub, index) => {
                    const isLocked = index >= freeCount; 
                    let colorClass = 'emerald';
                    let iconSVG = '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>';
                    
                    if (sub.nivel_alerta === 'Vermelho') { colorClass = 'rose'; iconSVG = '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>'; }
                    else if (sub.nivel_alerta === 'Laranja') { colorClass = 'orange'; iconSVG = '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>'; }
                    
                    const nomeExibicao = isLocked ? `<span class="blur-[6px] select-none text-slate-900 font-mono tracking-widest opacity-30">CONFIDENCIAL</span>` : sub.nome;
                    const valorExibicao = isLocked ? `<span class="blur-[5px] select-none opacity-40">00,00</span>` : sub.valor_mensal;
                    
                    const lockedBadge = isLocked 
                        ? `<button onclick="document.getElementById('paywall').scrollIntoView({behavior: 'smooth'})" class="bg-slate-900 text-white font-bold px-3 py-1.5 rounded-lg text-[9px] uppercase tracking-widest shadow-lg hover:bg-emerald-500 hover:text-slate-900 transition-colors relative z-30">Revelar</button>`
                        : `<span class="bg-${colorClass}-100 text-${colorClass}-700 font-bold px-2 py-1 rounded text-[9px] uppercase tracking-widest border border-${colorClass}-200">Visível</span>`;

                    lista.innerHTML += `
                        <div class="bg-white p-5 rounded-[1.5rem] shadow-sm border ${isLocked ? 'border-slate-200 locked-item' : `border-${colorClass}-200 shadow-md`} flex justify-between items-center relative overflow-hidden transition-all duration-300 hover:shadow-lg">
                            ${isLocked ? '<div class="absolute inset-0 bg-slate-50/50 pointer-events-none z-10 backdrop-blur-[1px]"></div>' : ''}
                            <div class="flex items-center gap-4 relative z-20">
                                <div class="w-12 h-12 shrink-0 rounded-2xl bg-${isLocked ? 'slate-100' : `${colorClass}-50`} border border-${isLocked ? 'slate-200' : `${colorClass}-100`} flex items-center justify-center text-${isLocked ? 'slate-400' : `${colorClass}-500`}">
                                    <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">${isLocked ? '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path>' : iconSVG}</svg>
                                </div>
                                <div>
                                    <p class="font-black text-slate-800 text-base sm:text-lg">${nomeExibicao}</p>
                                    <p class="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mt-0.5">${isLocked ? 'Cobrança Oculta' : sub.categoria}</p>
                                </div>
                            </div>
                            <div class="text-right flex flex-col items-end gap-2 relative z-20">
                                <p class="font-black text-xl sm:text-2xl text-slate-900">${valorExibicao}€</p>
                                ${lockedBadge}
                            </div>
                        </div>
                    `;
                });

                mostrarToast("Auditoria finalizada. Consulta o relatório abaixo.", "sucesso");
                areaResultados.scrollIntoView({ behavior: 'smooth', block: 'start' });

            }, 600); 
            
        } else {
            mostrarToast(resultado.erro || "Falha técnica na análise forense.", "erro");
            reiniciarUI();
        }

    } catch (erro) {
        clearInterval(textInterval); clearInterval(progressInterval);
        mostrarToast("Erro de comunicação com o cluster de IA. Tenta de novo.", "erro");
        reiniciarUI();
    }
});

function reiniciarUI() {
    document.getElementById('loadingStatus').classList.add('hidden');
    dropzone.classList.remove('hidden');
    btnAnalisar.classList.remove('hidden');
    btnAnalisar.classList.remove('animate-pulse-slow');
    btnAnalisar.disabled = false;
}

const btnPagar = document.getElementById('btnPagar');
if (btnPagar) {
    btnPagar.addEventListener('click', async () => {
        const txtBtn = document.getElementById('txtBtnPagar');
        btnPagar.disabled = true;
        txtBtn.innerHTML = `A preparar gateway segura... <svg class="animate-spin w-5 h-5 ml-2 inline" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" fill="none"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>`;

        try {
            const resposta = await fetch('/api/checkout', { method: 'POST' });
            const dados = await resposta.json();
            if (dados.url) {
                window.location.href = dados.url; 
            } else {
                mostrarToast("Falha na geração de checkout seguro.", "erro");
                btnPagar.disabled = false;
                txtBtn.innerHTML = `Desbloquear Relatório Completo <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M14 5l7 7m0 0l-7 7m7-7H3"></path></svg>`;
            }
        } catch (erro) {
            mostrarToast("O banco rejeitou a ligação. Verifica a tua net.", "erro");
            btnPagar.disabled = false;
            txtBtn.innerHTML = `Desbloquear Relatório Completo <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M14 5l7 7m0 0l-7 7m7-7H3"></path></svg>`;
        }
    });
}