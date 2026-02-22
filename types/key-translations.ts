export const translateKey = (key: string): string => translations.get(key) ?? key

const translations = new Map<string, string>()

for (let i = 1; i < 9; i++) {
    translations
        .set('RESONATOR-' + i, 'Resonator L' + i)
        .set('EMP_BURSTER-' + i, 'Burster L' + i)
        .set('ULTRA_STRIKE-' + i, 'Ultra Strike L' + i)
        .set('POWER_CUBE-' + i, 'Cube L' + i)
}

translations
    .set('ADA-0', 'ADA Refactor')
    .set('JARVIS-0', 'JARVIS Virus')
    .set('FRACK', 'Fracker')
    .set('BB_BATTLE', 'Battle Beacon')
    .set('FW_ENL', 'Fireworks ENL')
    .set('FW_RES', 'Fireworks RES')
    .set('APEX', 'Apex')
    .set('MEET', 'Meet-Up Beacon')
    .set('TOASTY', 'Toasty')
    .set('NIA', 'NIA Beacon')
    .set('BN_PEACE', 'Beacon Neutral Peace')
    .set('BN_BLM', 'Beacon BLM')
    .set('RES', 'Resistance Beacon')
    .set('ENL', 'Enlightened Beacon')
    .set('POWER_CUBE-9', 'Hyper Cube')
    .set('RES_SHIELD-COMMON', 'Shield Common')
    .set('RES_SHIELD-RARE', 'Shield Rare')
    .set('RES_SHIELD-VERY_RARE', 'Shield Very Rare')
    .set('EXTRA_SHIELD-VERY_RARE', 'Aegis Shield')
    .set('HEATSINK-COMMON', 'Heat Sink Common')
    .set('HEATSINK-RARE', 'Heat Sink Rare')
    .set('HEATSINK-VERY_RARE', 'Heat Sink Very Rare')
    .set('MULTIHACK-COMMON', 'Multi-Hack Common')
    .set('MULTIHACK-RARE', 'Multi-Hack Rare')
    .set('MULTIHACK-VERY_RARE', 'Multi-Hack Very Rare')
    .set('FORCE_AMP-RARE', 'Force Amp')
    .set('TURRET-RARE', 'Turret')
    .set('LINK_AMPLIFIER-RARE', 'Link Amp')
    .set('ULTRA_LINK_AMP-VERY_RARE', 'SoftBank Ultra Link')
    .set('TRANSMUTER_ATTACK-VERY_RARE', 'ITO EN- Transmuter')
    .set('TRANSMUTER_DEFENSE-VERY_RARE', 'ITO EN+ Transmuter')
