const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const DATA_FILE = path.join(DATA_DIR, 'levels.json');
const COOLDOWN_MS = 60_000;
const XP_MIN = 15;
const XP_MAX = 25;

const cooldowns = new Map();

function loadData() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify({ users: {} }, null, 2));
  }
  return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
}

function saveData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

function xpForLevel(level) {
  return 100 * level;
}

function addXp(userId) {
  const now = Date.now();
  if (cooldowns.get(userId) && now - cooldowns.get(userId) < COOLDOWN_MS) return null;

  cooldowns.set(userId, now);
  const data = loadData();
  if (!data.users[userId]) data.users[userId] = { xp: 0, level: 1 };

  const xpGain = XP_MIN + Math.floor(Math.random() * (XP_MAX - XP_MIN + 1));
  data.users[userId].xp += xpGain;

  let leveledUp = false;
  while (data.users[userId].xp >= xpForLevel(data.users[userId].level)) {
    data.users[userId].xp -= xpForLevel(data.users[userId].level);
    data.users[userId].level += 1;
    leveledUp = true;
  }

  saveData(data);
  return leveledUp ? data.users[userId].level : null;
}

module.exports = { addXp, loadData };
