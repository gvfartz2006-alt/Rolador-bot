import "dotenv/config";
import {
  Client,
  GatewayIntentBits,
  REST,
  Routes,
  SlashCommandBuilder,
} from "discord.js";

const SYMBOL_MAP = {
  d4: (v) => (v === 1 ? "☠︎" : v === 2 ? "𖣇" : v === 3 ? "♱" : "✧"),
  d6: (v) => (v <= 2 ? "☠︎" : v === 3 ? "𖣇" : v <= 5 ? "♱" : "✧"),
  d8: (v) => (v <= 2 ? "☠︎" : v <= 4 ? "𖣇" : v <= 6 ? "♱" : "✧"),
  d10: (v) => (v <= 2 ? "☠︎" : v <= 5 ? "𖣇" : v <= 8 ? "♱" : "✧"),
  d12: (v) => (v <= 3 ? "☠︎" : v <= 6 ? "𖣇" : v <= 9 ? "♱" : "✧"),
  d20: (v) => (v <= 5 ? "☠︎" : v <= 10 ? "𖣇" : v <= 15 ? "♱" : "✧"),
};
const DIE_SIZES = { d4: 4, d6: 6, d8: 8, d10: 10, d12: 12, d20: 20 };
const TABELAS = {
  d4: "**Tabela de Equivalência — d4**\n— 1 = Falha (☠︎)\n— 2 = Consequência (𖣇)\n— 3 = Sucesso (♱)\n— 4 = Nulo (✧)",
  d6: "**Tabela de Equivalência — d6**\n— 1-2 = Falha (☠︎)\n— 3 = Consequência (𖣇)\n— 4-5 = Sucesso (♱)\n— 6 = Nulo (✧)",
  d8: "**Tabela de Equivalência — d8**\n— 1-2 = Falha (☠︎)\n— 3-4 = Consequência (𖣇)\n— 5-6 = Sucesso (♱)\n— 7-8 = Nulo (✧)",
  d10: "**Tabela de Equivalência — d10**\n— 1-2 = Falha (☠︎)\n— 3-5 = Consequência (𖣇)\n— 6-8 = Sucesso (♱)\n— 9-10 = Nulo (✧)",
  d12: "**Tabela de Equivalência — d12**\n— 1-3 = Falha (☠︎)\n— 4-6 = Consequência (𖣇)\n— 7-9 = Sucesso (♱)\n— 10-12 = Nulo (✧)",
  d20: "**Tabela de Equivalência — d20**\n— 1-5 = Falha (☠︎)\n— 6-10 = Consequência (𖣇)\n— 11-15 = Sucesso (♱)\n— 16-20 = Nulo (✧)",
};
const DIE_CHOICES = ["d4", "d6", "d8", "d10", "d12", "d20"].map((d) => ({ name: d, value: d }));
const firstTimeUsers = new Set();
const userHistory = new Map();

function rollDie(die) {
  const value = Math.floor(Math.random() * DIE_SIZES[die]) + 1;
  return SYMBOL_MAP[die](value);
}
function isFirstTime(userId) {
  if (firstTimeUsers.has(userId)) return false;
  firstTimeUsers.add(userId);
  return true;
}
function saveHistory(userId, die, results) {
  const history = userHistory.get(userId) ?? [];
  history.push({ die, results, at: new Date().toLocaleTimeString("pt-BR") });
  if (history.length > 5) history.shift();
  userHistory.set(userId, history);
}

const commands = [
  new SlashCommandBuilder().setName("ping").setDescription("Verifica se o bot está online").toJSON(),
  new SlashCommandBuilder().setName("historico").setDescription("Mostra seus últimos 5 resultados da sessão").toJSON(),
  new SlashCommandBuilder().setName("roll").setDescription("Rola dados com símbolos místicos")
    .addStringOption((o) => o.setName("dado").setDescription("Tipo de dado").setRequired(true).addChoices(...DIE_CHOICES))
    .addStringOption((o) => o.setName("dados").setDescription("Quantidade (ex: 3) ou separados (ex: #3). Padrão: 1").setRequired(false))
    .toJSON(),
  new SlashCommandBuilder().setName("tabela").setDescription("Mostra a tabela de equivalência dos símbolos")
    .addStringOption((o) => o.setName("dado").setDescription("Tipo de dado (padrão: d8)").setRequired(false).addChoices(...DIE_CHOICES))
    .toJSON(),
];

const token = process.env.DISCORD_TOKEN;
if (!token) { console.error("DISCORD_TOKEN não encontrado!"); process.exit(1); }

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once("clientReady", async (c) => {
  console.log(`Bot online como ${c.user.tag}`);
  const rest = new REST().setToken(token);
  const guildId = process.env.DISCORD_GUILD_ID;
  if (guildId) {
    await rest.put(Routes.applicationGuildCommands(c.user.id, guildId), { body: commands });
    console.log(`Comandos registrados no servidor!`);
  } else {
    await rest.put(Routes.applicationCommands(c.user.id), { body: commands });
    console.log("Comandos registrados globalmente!");
  }
});

client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === "roll") {
    const die = interaction.options.getString("dado") ?? "d8";
    const rawInput = interaction.options.getString("dados") ?? "1";
    const isSeparated = rawInput.startsWith("#");
    const quantidade = Math.min(100, Math.max(1, parseInt(isSeparated ? rawInput.slice(1) : rawInput, 10) || 1));
    const results = Array.from({ length: quantidade }, () => rollDie(die));
    const lines = [];
    if (isFirstTime(interaction.user.id)) lines.push(TABELAS[die], "");
    if (quantidade === 1) {
      lines.push(`Seu resultado é......... **${results[0]}**!!!`);
    } else {
      lines.push("Seus resultados são", "");
      if (isSeparated) results.forEach((s) => lines.push(`- ${s}`));
      else lines.push(results.map((s) => `- ${s}`).join("\n"));
    }
    saveHistory(interaction.user.id, die, results);
    await interaction.reply({ content: lines.join("\n") });
  }

  if (interaction.commandName === "ping") {
    await interaction.reply({ content: `✧ Online! Latência: ${Date.now() - interaction.createdTimestamp}ms` });
  }

  if (interaction.commandName === "historico") {
    const history = userHistory.get(interaction.user.id);
    if (!history || history.length === 0) {
      await interaction.reply({ content: "Você ainda não rolou nenhum dado nessa sessão!" });
      return;
    }
    const lines = ["**Seus últimos resultados**", ""];
    history.slice().reverse().forEach((entry, i) => lines.push(`${i + 1}. [${entry.die} — ${entry.at}] ${entry.results.join(" ")}`));
    await interaction.reply({ content: lines.join("\n") });
  }

  if (interaction.commandName === "tabela") {
    await interaction.reply({ content: TABELAS[interaction.options.getString("dado") ?? "d8"] });
  }
});

client.login(token);
