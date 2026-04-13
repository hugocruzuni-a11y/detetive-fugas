require('dotenv').config();

async function radarGoogle() {
    console.log("📡 A ligar o Radar diretamente à Base de Dados da Google...\n");
    const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${process.env.GEMINI_API_KEY}`;

    try {
        const resposta = await fetch(url);
        const dados = await resposta.json();

        if (dados.error) {
            console.log("🚨 A GOOGLE BLOQUEOU O RADAR:");
            console.log(dados.error.message);
            return;
        }

        console.log("✅ SUCESSO! Estes são os modelos exatos que a Google te autoriza a usar:");
        dados.models.forEach(modelo => {
            if (modelo.supportedGenerationMethods && modelo.supportedGenerationMethods.includes("generateContent")) {
                console.log(`➡️  ${modelo.name.replace('models/', '')}`);
            }
        });

    } catch (erro) {
        console.log("❌ Erro:", erro.message);
    }
}

radarGoogle();