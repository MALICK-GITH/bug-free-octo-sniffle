const dbService = require('./services/database');

async function testDatabase() {
  try {
    console.log('🔗 Test de connexion à la base de données...');
    const health = await dbService.healthCheck();
    console.log('✅ Résultat du test:', JSON.stringify(health, null, 2));
    
    // Test de création de table
    console.log('🗄️ Test de création des tables...');
    await dbService.createTables();
    console.log('✅ Tables créées avec succès');
    
    // Test d'insertion
    console.log('📝 Test d\'insertion d\'un match...');
    const testMatch = await dbService.saveMatch({
      match_id: 'test_001',
      team1: 'Équipe Test A',
      team2: 'Équipe Test B',
      league: 'Ligue Test',
      status: 'upcoming',
      odds: { home: 2.5, draw: 3.2, away: 2.8 },
      prediction: { confidence: 0.85, recommendation: 'home' }
    });
    console.log('✅ Match inséré:', JSON.stringify(testMatch, null, 2));
    
    // Test de récupération
    console.log('🔍 Test de récupération du match...');
    const retrievedMatch = await dbService.getMatch('test_001');
    console.log('✅ Match récupéré:', JSON.stringify(retrievedMatch, null, 2));
    
    // Test des coupons
    console.log('🎫 Test de création de coupon...');
    const testCoupon = await dbService.saveCoupon({
      coupon_id: 'coupon_test_001',
      user_id: 'test_user',
      matches: [{ match_id: 'test_001' }],
      stake: 1000,
      total_odds: 2.5,
      potential_win: 2500,
      risk_profile: 'balanced'
    });
    console.log('✅ Coupon créé:', JSON.stringify(testCoupon, null, 2));
    
    console.log('🎯 TOUS LES TESTS RÉUSSIS - Base de données fonctionnelle!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Erreur lors du test:', error.message);
    process.exit(1);
  }
}

testDatabase();
