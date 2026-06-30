const VERIFY_BUTTON = 'verify_18plus';

async function handleVerify(interaction) {
  const role = interaction.guild.roles.cache.find((r) => r.name === 'Verified 18+');
  if (!role) {
    return interaction.reply({ content: '❌ Verified-18+-Rolle nicht gefunden. Bitte /setup-server ausführen.', ephemeral: true });
  }

  if (interaction.member.roles.cache.has(role.id)) {
    return interaction.reply({ content: '✅ Du bist bereits verifiziert.', ephemeral: true });
  }

  await interaction.member.roles.add(role);
  await interaction.reply({ content: '✅ Altersverifizierung bestätigt! Du hast die Rolle **Verified 18+** erhalten.', ephemeral: true });
}

module.exports = { VERIFY_BUTTON, handleVerify };
