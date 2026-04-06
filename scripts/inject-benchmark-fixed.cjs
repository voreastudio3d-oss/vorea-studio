const fs = require('fs');
const path = require('path');

const localesDir = path.join(__dirname, '..', 'src', 'app', 'locales');

const benchmarkEn = {
  heroTitle: "Vorea Studio vs The 3D Ecosystem",
  heroSubtitle: "A transparent benchmark of parametric models, communities, and our product vision.",
  fodaTitle: "SWOT Analysis",
  fodaStrengthsTitle: "Strengths",
  fodaStrengthsItems: [
    "Web-based parametric editor with native SCAD",
    "Generative AI pipeline (Prompt → SCAD)",
    "8 locales supported from Day 1",
    "Integrated community with direct publishing",
    "Modern stack (Vite + Three.js + Node) without desktop dependencies",
    "Ultra-low cost for users ($4-$14.5/mo)"
  ],
  fodaWeaknessesTitle: "Weaknesses",
  fodaWeaknessesItems: [
    "User base still growing / lacks critical mass",
    "Limited parametric family catalog currently",
    "No built-in slicer (only GCode viewer)",
    "Single payment gateway (PayPal)",
    "Minimal founder-led team"
  ],
  fodaOpportunitiesTitle: "Opportunities",
  fodaOpportunitiesItems: [
    "Thingiverse Customizer in decline -> Vorea can capture that audience",
    "MakerWorld Customizer only accepts Bambu SCAD -> Vorea generates compatible SCAD",
    "3D printing market growing fast (+20% YoY)",
    "Generative AI as a massive acquisition hook",
    "STEM Education as a massive inbound channel"
  ],
  fodaThreatsTitle: "Threats",
  fodaThreatsItems: [
    "Autodesk/Bambu Lab might improve their free web tools",
    "AI CAD tools from big players (Fusion AI, PTC Onshape)",
    "Dependency on external APIs (MakerWorld, PayPal, Google AI)"
  ],
  benchmarkTitle: "3D Ecosystem Benchmark",
  benchmarkModelsTitle: "1) Parametric Models & Communities",
  bHeaderPlatform: "Platform",
  bHeaderWhy: "Why it matters",
  bHeaderReplicate: "What we replicate",
  bHeaderAvoid: "What we avoid",
  bMakerWorldWhy: "Unites catalog, community, print profiles, and reputation.",
  bMakerWorldReplicate: "Collections, community per asset, rich tags, successful print proofs.",
  bMakerWorldAvoid: "Strict hardware ecosystem lock-in.",
  bPrintablesWhy: "Highly active community, badges, clubs, and contests.",
  bPrintablesReplicate: "Thematic clubs, contests, collections, activity-based reputation.",
  bPrintablesAvoid: "Gamification that overshadows content.",
  bThangsWhy: "Stands out for 3D-native search and versioning focus.",
  bThangsReplicate: "Semantic search, versions, attachments, technical metadata.",
  bThangsAvoid: "Complex commercial-first funnel.",
  bThingiverseWhy: "Historical reference for remixing, customizer, and volume.",
  bThingiverseReplicate: "'Customize' button, visible derivations, remix community.",
  bThingiverseAvoid: "Legacy UX, heavy and outdated navigation.",
  bMyMiniFactoryWhy: "Combines store, community, and printable file trust.",
  bMyMiniFactoryReplicate: "Trust badges, makes, curated collections.",
  bMyMiniFactoryAvoid: "Extremely strict gatekeeping stopping fast publishing.",
  bCultsWhy: "Mixes marketplace with creator identity and social activity.",
  bCultsReplicate: "Author profiles, followers, likes, downloads, badges.",
  bCultsAvoid: "Marketplace-first approach without a real community feel.",
  laserTitle: "2) Laser Cutting & Craft Files",
  bPonokoWhy: "Unites on-demand manufacturing with files and guides.",
  bPonokoReplicate: "Cutting preview, materials, clear templates.",
  bPonokoAvoid: "Complex quoting flows that scare early creators.",
  bDesignBundlesWhy: "Strong commercial catalog for ready-to-cut files.",
  bDesignBundlesReplicate: "Bundles, format filters, instant downloads.",
  bDesignBundlesAvoid: "Excessive commercial noise and generic supply.",
  bCreativeWhy: "Huge library + subscription model for crafts/laser.",
  bCreativeReplicate: "Themed packs, layer previews.",
  bCreativeAvoid: "Poor discovery squeezed into endless homogeneous offers.",
  newsTitle: "3) 3D News & Media",
  bNewsDesc1: "Specialized media platforms.",
  bNewsReplicate1: "Curated editorial, fast reading, original sources linked.",
  bNewsAvoid1: "Copy-pasting full articles without adding value."
};

const benchmarkEs = {
  heroTitle: "Vorea Studio vs El Ecosistema 3D",
  heroSubtitle: "Un benchmark transparente sobre modelos paramétricos, comunidades y nuestra visión de producto.",
  fodaTitle: "Análisis FODA",
  fodaStrengthsTitle: "Fortalezas",
  fodaStrengthsItems: [
    "Editor paramétrico web-based con SCAD nativo",
    "Pipeline IA generativa (Prompt → SCAD)",
    "Multilenguaje (8 locales) desde el día 1",
    "Comunidad integrada con publicación directa",
    "Stack moderno (Vite + Three.js + Node) sin dependencia desktop",
    "Costo ultra-bajo para el usuario ($4-$14.5/mes)"
  ],
  fodaWeaknessesTitle: "Debilidades",
  fodaWeaknessesItems: [
    "Base de usuarios aún pequeña / falta masa crítica",
    "Catálogo de familias paramétricas limitado actualmente",
    "Sin slicing integrado propio (solo visor GCode)",
    "Una sola pasarela de pago (PayPal)",
    "Equipo mínimo (founder-led)"
  ],
  fodaOpportunitiesTitle: "Oportunidades",
  fodaOpportunitiesItems: [
    "Thingiverse Customizer en declive -> Vorea puede captar esa audiencia",
    "MakerWorld Customizer solo acepta SCAD de Bambu -> Vorea genera SCAD compatible",
    "Mercado de impresión 3D en crecimiento constante (+20% anual)",
    "IA generativa como gancho masivo de adquisición",
    "Educación STEM como canal de entrada masivo"
  ],
  fodaThreatsTitle: "Amenazas",
  fodaThreatsItems: [
    "Autodesk/Bambu Lab podrían mejorar sus herramientas web gratuitas",
    "CAD con IA de actores grandes (Fusion AI, PTC Onshape)",
    "Dependencia de APIs externas (MakerWorld, PayPal, Google AI)"
  ],
  benchmarkTitle: "Benchmark del Ecosistema 3D",
  benchmarkModelsTitle: "1) Modelos Paramétricos y Comunidades",
  bHeaderPlatform: "Plataforma",
  bHeaderWhy: "Por qué importa",
  bHeaderReplicate: "Qué replicamos",
  bHeaderAvoid: "Qué evitamos",
  bMakerWorldWhy: "Une catálogo, comunidad, perfiles de impresión y reputación.",
  bMakerWorldReplicate: "Colecciones, comunidad por asset, tags ricos, pruebas de impresiones exitosas.",
  bMakerWorldAvoid: "Lock-in estricto de ecosistema de hardware.",
  bPrintablesWhy: "Comunidad muy activa, badges, clubes y concursos.",
  bPrintablesReplicate: "Clubes temáticos, concursos, colecciones, reputación por actividad.",
  bPrintablesAvoid: "Gamificación que opaca el contenido.",
  bThangsWhy: "Búsqueda 3D-native y enfoque en versionado/descubrimiento.",
  bThangsReplicate: "Búsqueda semántica, versiones, archivos adjuntos, metadata técnica.",
  bThangsAvoid: "Funnel comercial complejo.",
  bThingiverseWhy: "Referencia histórica para remix, customizer y volumen.",
  bThingiverseReplicate: "Botón de 'Personalizar', derivaciones visibles, comunidad de remix.",
  bThingiverseAvoid: "UX legacy, navegación pesada y anticuada.",
  bMyMiniFactoryWhy: "Combina tienda, comunidad y confianza en archivos imprimibles.",
  bMyMiniFactoryReplicate: "Badges de confianza, makes, colecciones curadas.",
  bMyMiniFactoryAvoid: "Gatekeeping estricto que frena la publicación rápida.",
  bCultsWhy: "Mezcla marketplace con identidad del creador y actividad social.",
  bCultsReplicate: "Perfiles de autor, seguidores, likes, descargas, badges.",
  bCultsAvoid: "Enfoque marketplace-first sin sensación de comunidad real.",
  laserTitle: "2) Corte Láser y Archivos Craft",
  bPonokoWhy: "Une fabricación bajo demanda con archivos y guías.",
  bPonokoReplicate: "Preview de corte, materiales, plantillas claras.",
  bPonokoAvoid: "Flujos de cotización complejos que espantan a creadores tempranos.",
  bDesignBundlesWhy: "Catálogo comercial fuerte de archivos listos para láser.",
  bDesignBundlesReplicate: "Bundles, filtros por formato, descarga instantánea.",
  bDesignBundlesAvoid: "Ruido comercial excesivo y oferta genérica.",
  bCreativeWhy: "Biblioteca inmensa + suscripción para craft/láser.",
  bCreativeReplicate: "Packs temáticos, previews por capas.",
  bCreativeAvoid: "Descubrimiento pobre ahogado entre demasiada oferta homogénea.",
  newsTitle: "3) Noticias y Medios 3D",
  bNewsDesc1: "Medios especializados en impresión 3D.",
  bNewsReplicate1: "Curación editorial, lectura rápida, resumen propio y cita de fuente.",
  bNewsAvoid1: "Copiar textos externos de forma automática sin curación."
};

const benchmarkPt = {
  heroTitle: "Vorea Studio vs O Ecossistema 3D",
  heroSubtitle: "Um benchmark transparente sobre modelos paramétricos, comunidades e nossa visão de produto.",
  fodaTitle: "Análise SWOT (FODA)",
  fodaStrengthsTitle: "Forças",
  fodaStrengthsItems: [
    "Editor paramétrico web-based com SCAD nativo",
    "Pipeline IA generativa (Prompt → SCAD)",
    "Multilíngue (8 idiomas) desde o dia 1",
    "Comunidade integrada com publicação direta",
    "Stack moderno (Vite + Three.js + Node) sem dependência desktop",
    "Custo ultra-baixo para os usuários ($4-$14.5/mês)"
  ],
  fodaWeaknessesTitle: "Fraquezas",
  fodaWeaknessesItems: [
    "Base de usuários ainda crescendo / falta massa crítica",
    "Catálogo de famílias paramétricas limitado atualmente",
    "Sem fatiador próprio integrado (apenas visualizador GCode)",
    "Apenas um gateway de pagamento (PayPal)",
    "Equipe mínima (founder-led)"
  ],
  fodaOpportunitiesTitle: "Oportunidades",
  fodaOpportunitiesItems: [
    "Declínio do Thingiverse Customizer -> Vorea pode atrair esse público",
    "MakerWorld Customizer aceita apenas Bambu SCAD -> Vorea gera SCAD compatível",
    "Mercado de impressão 3D em constante crescimento (+20% ao ano)",
    "IA generativa como forte isca de aquisição",
    "Educação STEM como grande canal de entrada"
  ],
  fodaThreatsTitle: "Ameaças",
  fodaThreatsItems: [
    "Autodesk/Bambu Lab podem melhorar suas ferramentas web gratuitas",
    "Ferramentas CAD com IA de gigantes (Fusion AI, PTC Onshape)",
    "Dependência de APIs externas (MakerWorld, PayPal, Google AI)"
  ],
  benchmarkTitle: "Benchmark do Ecossistema 3D",
  benchmarkModelsTitle: "1) Modelos Paramétricos e Comunidades",
  bHeaderPlatform: "Plataforma",
  bHeaderWhy: "Por que importa",
  bHeaderReplicate: "O que replicamos",
  bHeaderAvoid: "O que evitamos",
  bMakerWorldWhy: "Une catálogo, comunidade, perfis de impressão e reputação.",
  bMakerWorldReplicate: "Coleções, comunidade por asset, tags ricas, provas de impressão com sucesso.",
  bMakerWorldAvoid: "Forte aprisionamento ao ecossistema de hardware.",
  bPrintablesWhy: "Comunidade muito ativa, badges, clubes e concursos.",
  bPrintablesReplicate: "Clubes temáticos, concursos, coleções, reputação por atividade.",
  bPrintablesAvoid: "Gamificação que ofusca o conteúdo.",
  bThangsWhy: "Pesquisa 3D-native e foco em versionamento/descoberta.",
  bThangsReplicate: "Pesquisa semântica, versões, anexos, metadados técnicos.",
  bThangsAvoid: "Funil comercial complexo.",
  bThingiverseWhy: "Referência histórica para remixes, customizer e volume.",
  bThingiverseReplicate: "Botão 'Personalizar', derivações visíveis, comunidade de remixes.",
  bThingiverseAvoid: "UX arcaico, navegação pesada e ultrapassada.",
  bMyMiniFactoryWhy: "Combina loja, comunidade e confiança nos arquivos para impressão.",
  bMyMiniFactoryReplicate: "Selos de confiança, makes, coleções selecionadas.",
  bMyMiniFactoryAvoid: "Gatekeeping rígido que dificulta publicações ágeis.",
  bCultsWhy: "Mistura marketplace com identidade do criador e atividade social.",
  bCultsReplicate: "Perfis de autor, seguidores, likes, downloads, badges.",
  bCultsAvoid: "Abordagem focada no mercado sem uma sensação de comunidade real.",
  laserTitle: "2) Corte a Laser e Arquivos Craft",
  bPonokoWhy: "Une fabricação sob demanda com arquivos e guias.",
  bPonokoReplicate: "Preview de corte, materiais, modelos claros.",
  bPonokoAvoid: "Fluxos de orçamento complexos que afastam novos criadores.",
  bDesignBundlesWhy: "Forte catálogo comercial para arquivos prontos para o laser.",
  bDesignBundlesReplicate: "Pacotes, filtros de formato, downloads instantâneos.",
  bDesignBundlesAvoid: "Excesso de apelo comercial e ofertas muito genéricas.",
  bCreativeWhy: "Biblioteca massiva + assinatura para craft/laser.",
  bCreativeReplicate: "Pacotes temáticos, previews por camadas.",
  bCreativeAvoid: "Descoberta muito difícil entre ofertas extremamente homogêneas.",
  newsTitle: "3) Notícias e Mídia 3D",
  bNewsDesc1: "Plataformas de mídia especializada.",
  bNewsReplicate1: "Curadoria editorial, leitura rápida, links originais.",
  bNewsAvoid1: "Copiar textos externos de forma automática sem agregar valor."
};

function injectBenchmark(langFile, newKeys) {
  const filePath = path.join(localesDir, langFile);
  if (fs.existsSync(filePath)) {
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    data.benchmark = newKeys;
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    console.log("Injected into", langFile);
  } else {
    console.log("Not found:", langFile);
  }
}

injectBenchmark('en.json', benchmarkEn);
injectBenchmark('es.json', benchmarkEs);
injectBenchmark('pt.json', benchmarkPt);
