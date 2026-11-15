// Shared sound-pack engine for the game and the replay viewer.
//
// The default pack uses the TETR.IO sound effects in assets/sfx/tetrio/.
// The practice pack keeps the original Tetroblox WAVs and borrows the TETR.IO
// combo/B2B/surge/danger cues. The classic pack is the original WAVs only.
// Custom packs are folders of WAV/OGG/MP3 files named after the sound effect;
// they are stored in IndexedDB and fall back to the TETR.IO pack when a file
// is missing.
(function (root) {
	'use strict';

	const STORAGE_KEY = 'zztetris_sound_pack';
	const DB_NAME = 'zztetris_sound_packs';
	const DB_VERSION = 1;
	const STORE = 'files';
	const MAX_CUSTOM_BYTES = 20 * 1024 * 1024;
	const DEFAULT_PACK = 'tetrio';

	const TETRIO_FILES = {
		Move: 'assets/sfx/tetrio/move.mp3?v=ff8fad9e',
		Rotate: 'assets/sfx/tetrio/rotate.mp3?v=7adb458d',
		Hold: 'assets/sfx/tetrio/hold.mp3?v=af73861e',
		HardDrop: 'assets/sfx/tetrio/harddrop.mp3?v=b9250e6a',
		SoftDrop: 'assets/sfx/tetrio/softdrop.mp3?v=7c0bf0cc',
		LockDelay: 'assets/sfx/tetrio/floor.mp3?v=c10964fc',
		ClearLine: 'assets/sfx/tetrio/clearline.mp3?v=6793f12c',
		ClearQuad: 'assets/sfx/tetrio/clearquad.mp3?v=4f4ededd',
		ClearSpin: 'assets/sfx/tetrio/clearspin.mp3?v=d5c70c1f',
		ClearB2B: 'assets/sfx/tetrio/clearbtb.mp3?v=93512e78',
		PerfectClear: 'assets/sfx/tetrio/allclear.mp3?v=4b9fed1f',
		Combo1: 'assets/sfx/tetrio/combo_1.mp3?v=393e0248',
		Combo2: 'assets/sfx/tetrio/combo_2.mp3?v=94723731',
		Combo3: 'assets/sfx/tetrio/combo_3.mp3?v=84cfb376',
		Combo4: 'assets/sfx/tetrio/combo_4.mp3?v=4d1964b2',
		Combo5: 'assets/sfx/tetrio/combo_5.mp3?v=f193f621',
		Combo6: 'assets/sfx/tetrio/combo_6.mp3?v=f8ca0576',
		Combo7: 'assets/sfx/tetrio/combo_7.mp3?v=45e2818e',
		Combo8: 'assets/sfx/tetrio/combo_8.mp3?v=2914251e',
		Combo9: 'assets/sfx/tetrio/combo_9.mp3?v=31df1808',
		Combo10: 'assets/sfx/tetrio/combo_10.mp3?v=f0930c71',
		Combo11: 'assets/sfx/tetrio/combo_11.mp3?v=f697b4fc',
		Combo12: 'assets/sfx/tetrio/combo_12.mp3?v=baa6b16a',
		Combo13: 'assets/sfx/tetrio/combo_13.mp3?v=5daebd6d',
		Combo14: 'assets/sfx/tetrio/combo_14.mp3?v=a402bafe',
		Combo15: 'assets/sfx/tetrio/combo_15.mp3?v=37502dd9',
		Combo16: 'assets/sfx/tetrio/combo_16.mp3?v=0be906ff',
		B2B1: 'assets/sfx/tetrio/btb_1.mp3?v=f5e696e2',
		B2B2: 'assets/sfx/tetrio/btb_2.mp3?v=cc1f6c19',
		B2B3: 'assets/sfx/tetrio/btb_3.mp3?v=403ab8ef',
		B2BBreak: 'assets/sfx/tetrio/btb_break.mp3?v=e1d850cd',
		GarbageLight: 'assets/sfx/tetrio/damage_small.mp3?v=eab17ad5',
		GarbageMed: 'assets/sfx/tetrio/damage_medium.mp3?v=eb64afad',
		GarbageLarge: 'assets/sfx/tetrio/damage_large.mp3?v=ad499f81',
		IncomingLight: 'assets/sfx/tetrio/damage_alert.mp3?v=09eef0a5',
		IncomingMed: 'assets/sfx/tetrio/damage_alert.mp3?v=09eef0a5',
		IncomingLarge: 'assets/sfx/tetrio/damage_alert.mp3?v=09eef0a5',
		Danger: 'assets/sfx/tetrio/warning.mp3?v=613bb538',
		HyperDanger: 'assets/sfx/tetrio/hyperalert.mp3?v=64289af1',
		FinesseFault: 'assets/sfx/tetrio/finessefault.mp3?v=d578a061',
		SlowDown: 'assets/sfx/tetrio/warning.mp3?v=613bb538',
		TSpin1: 'assets/sfx/tetrio/clearspin.mp3?v=d5c70c1f',
		TopOut: 'assets/sfx/tetrio/topout.mp3?v=00675c33',
		Finish: 'assets/sfx/tetrio/finish.mp3?v=11a99a18',
		GameOver: 'assets/sfx/tetrio/gameover.mp3?v=a2633036',
		ComboBreak: 'assets/sfx/tetrio/combobreak.mp3?v=e40a77eb',
		Hit: 'assets/sfx/tetrio/hit.mp3?v=f04cdcb0',
		Undo: 'assets/sfx/tetrio/undo.mp3?v=bb3a6442',
		Redo: 'assets/sfx/tetrio/redo.mp3?v=8aa002a1',
		Spin: 'assets/sfx/tetrio/spin.mp3?v=ecf529e1',
		SpinEnd: 'assets/sfx/tetrio/spinend.mp3?v=9072cca3',
		B2BChargeStart: 'assets/sfx/tetrio/b2bcharge_start.mp3?v=a33a0f32',
		B2BCharge1: 'assets/sfx/tetrio/b2bcharge_1.mp3?v=b72aa295',
		B2BCharge2: 'assets/sfx/tetrio/b2bcharge_2.mp3?v=0a176289',
		B2BCharge3: 'assets/sfx/tetrio/b2bcharge_3.mp3?v=7cc90c59',
		B2BCharge4: 'assets/sfx/tetrio/b2bcharge_4.mp3?v=71cec0ec',
		B2BChargeDistance1: 'assets/sfx/tetrio/b2bcharge_distance_1.mp3?v=5408e746',
		B2BChargeDistance2: 'assets/sfx/tetrio/b2bcharge_distance_2.mp3?v=88f1dfe8',
		B2BChargeDistance3: 'assets/sfx/tetrio/b2bcharge_distance_3.mp3?v=ee4a2f1e',
		B2BChargeBlast1: 'assets/sfx/tetrio/b2bcharge_blast_1.mp3?v=ac2083dd',
		B2BChargeBlast2: 'assets/sfx/tetrio/b2bcharge_blast_2.mp3?v=e6b53f2a',
		B2BChargeBlast3: 'assets/sfx/tetrio/b2bcharge_blast_3.mp3?v=a6f46418',
		B2BChargeBlast4: 'assets/sfx/tetrio/b2bcharge_blast_4.mp3?v=28ad7755',
		B2BChargeDanger: 'assets/sfx/tetrio/b2bcharge_danger.mp3?v=5b4b310a',
		GarbageOutLight: 'assets/sfx/tetrio/garbage_out_small.mp3?v=eb69ea05',
		GarbageOutMed: 'assets/sfx/tetrio/garbage_out_medium.mp3?v=5dd6c1a2',
		GarbageOutLarge: 'assets/sfx/tetrio/garbage_out_large.mp3?v=383e69fd',
		GarbageInLight: 'assets/sfx/tetrio/garbage_in_small.mp3?v=c59bb7c0',
		GarbageInMed: 'assets/sfx/tetrio/garbage_in_medium.mp3?v=00251c8d',
		GarbageInLarge: 'assets/sfx/tetrio/garbage_in_large.mp3?v=e044c69e',
		GarbageWindup1: 'assets/sfx/tetrio/garbagewindup_1.mp3?v=51daa93b',
		GarbageWindup2: 'assets/sfx/tetrio/garbagewindup_2.mp3?v=ab1ed989',
		GarbageWindup3: 'assets/sfx/tetrio/garbagewindup_3.mp3?v=02a4394c',
		GarbageWindup4: 'assets/sfx/tetrio/garbagewindup_4.mp3?v=095cfd64',
		GarbageRise: 'assets/sfx/tetrio/garbagerise.mp3?v=3d0a38b7',
		GarbageSmash: 'assets/sfx/tetrio/garbagesmash.mp3?v=9d4c59e3',
		Counter: 'assets/sfx/tetrio/counter.mp3?v=ffb3aabe',
		Impact: 'assets/sfx/tetrio/impact.mp3?v=8b1aaf2e',
		Exchange: 'assets/sfx/tetrio/exchange.mp3?v=51775a3c',
		Offset: 'assets/sfx/tetrio/offset.mp3?v=4de2a465',
		ProtectedSmall: 'assets/sfx/tetrio/protected_small.mp3?v=00c744e9',
		ProtectedMedium: 'assets/sfx/tetrio/protected_medium.mp3?v=394d5331',
		ProtectedLarge: 'assets/sfx/tetrio/protected_large.mp3?v=67ca8a06',
		Death: 'assets/sfx/tetrio/death.mp3?v=daedb593',
		Victory: 'assets/sfx/tetrio/victory.mp3?v=551b9ef4',
		LoseStock: 'assets/sfx/tetrio/losestock.mp3?v=b28ece6e',
		LevelUp: 'assets/sfx/tetrio/levelup.mp3?v=2e2a5209',
		Level10: 'assets/sfx/tetrio/level10.mp3?v=2786499f',
		Level100: 'assets/sfx/tetrio/level100.mp3?v=d69c5e4e',
		Level500: 'assets/sfx/tetrio/level500.mp3?v=d337e598',
		RatingRaise: 'assets/sfx/tetrio/ratingraise.mp3?v=d3b6ee73',
		RatingLower: 'assets/sfx/tetrio/ratinglower.mp3?v=aec99e0c',
		RankRaise: 'assets/sfx/tetrio/rankraise.mp3?v=76275f8c',
		RankLower: 'assets/sfx/tetrio/ranklower.mp3?v=5c67d844',
		PersonalBest: 'assets/sfx/tetrio/personalbest.mp3?v=29341a8f',
		WorldRecord: 'assets/sfx/tetrio/worldrecord.mp3?v=8888be08',
		Achievement1: 'assets/sfx/tetrio/achievement_1.mp3?v=3165108e',
		Achievement2: 'assets/sfx/tetrio/achievement_2.mp3?v=e8d1853b',
		Achievement3: 'assets/sfx/tetrio/achievement_3.mp3?v=6c62ca62',
		Supporter: 'assets/sfx/tetrio/supporter.mp3?v=0c2c1d76',
		PurchaseStart: 'assets/sfx/tetrio/purchase_start.mp3?v=145ba9e6',
		ShowScore: 'assets/sfx/tetrio/showscore.mp3?v=e57388e2',
		ScoreSlideIn: 'assets/sfx/tetrio/scoreslide_in.mp3?v=a2113a25',
		ScoreSlideOut: 'assets/sfx/tetrio/scoreslide_out.mp3?v=1a6e0d7d',
		MatchIntro: 'assets/sfx/tetrio/matchintro.mp3?v=40765fe6',
		Countdown1: 'assets/sfx/tetrio/countdown1.mp3?v=fbb15daa',
		Countdown2: 'assets/sfx/tetrio/countdown2.mp3?v=c05b86c6',
		Countdown3: 'assets/sfx/tetrio/countdown3.mp3?v=d01b1a32',
		Countdown4: 'assets/sfx/tetrio/countdown4.mp3?v=56ee57ff',
		Countdown5: 'assets/sfx/tetrio/countdown5.mp3?v=9702d691',
		Go: 'assets/sfx/tetrio/go.mp3?v=ac36e8ba',
		Elim: 'assets/sfx/tetrio/elim.mp3?v=e593f043',
		Applause: 'assets/sfx/tetrio/applause.mp3?v=ce060e04',
		PartyReady: 'assets/sfx/tetrio/party_ready.mp3?v=2170405f',
		UserJoin: 'assets/sfx/tetrio/userjoin.mp3?v=a256cf0a',
		UserLeave: 'assets/sfx/tetrio/userleave.mp3?v=74ae4775',
	};

	const PRACTICE_FILES = {
		Move: 'assets/sfx/Move.wav?v=7a06b53c',
		Rotate: 'assets/sfx/Rotate.wav?v=abc17339',
		Hold: 'assets/sfx/Hold.wav?v=38c3a6d1',
		HardDrop: 'assets/sfx/HardDrop.wav?v=1952b7d9',
		SoftDrop: 'assets/sfx/SoftDrop.wav?v=d65a283f',
		LockDelay: 'assets/sfx/LockDelay.wav?v=361b2858',
		ClearQuad: 'assets/sfx/ClearTetra.wav?v=f48380fa',
		ClearSpin: 'assets/sfx/ClearTetra.wav?v=f48380fa',
		ClearB2B: 'assets/sfx/ClearTetra.wav?v=f48380fa',
		PerfectClear: 'assets/sfx/PerfectClear.wav?v=62fb36cf',
		GarbageLight: 'assets/sfx/GarbageLight.wav?v=c3273188',
		GarbageMed: 'assets/sfx/GarbageMed.wav?v=184bbae6',
		GarbageLarge: 'assets/sfx/GarbageLarge.wav?v=6166f662',
		IncomingLight: 'assets/sfx/IncomingLight.wav?v=33fbdab9',
		IncomingMed: 'assets/sfx/IncomingMed.wav?v=7d82d4ee',
		IncomingLarge: 'assets/sfx/IncomingLarge.wav?v=c2bc21e0',
		FinesseFault: 'assets/sfx/FinesseFault.wav?v=a260b135',
		SlowDown: 'assets/sfx/SlowDown.wav?v=65a72722',
		TSpin1: 'assets/sfx/TSpin1.wav?v=0173cf5f',
		TopOut: 'assets/sfx/TopOut.wav?v=b82c31c6',
		Finish: 'assets/sfx/Finish.wav?v=1b4aa530',
		// The original pack has no combo/B2B/danger sounds; borrow the
		// TETR.IO cues so the extra cues still work.
		Combo1: 'assets/sfx/tetrio/combo_1.mp3?v=393e0248',
		Combo2: 'assets/sfx/tetrio/combo_2.mp3?v=94723731',
		Combo3: 'assets/sfx/tetrio/combo_3.mp3?v=84cfb376',
		Combo4: 'assets/sfx/tetrio/combo_4.mp3?v=4d1964b2',
		Combo5: 'assets/sfx/tetrio/combo_5.mp3?v=f193f621',
		Combo6: 'assets/sfx/tetrio/combo_6.mp3?v=f8ca0576',
		Combo7: 'assets/sfx/tetrio/combo_7.mp3?v=45e2818e',
		Combo8: 'assets/sfx/tetrio/combo_8.mp3?v=2914251e',
		Combo9: 'assets/sfx/tetrio/combo_9.mp3?v=31df1808',
		Combo10: 'assets/sfx/tetrio/combo_10.mp3?v=f0930c71',
		Combo11: 'assets/sfx/tetrio/combo_11.mp3?v=f697b4fc',
		Combo12: 'assets/sfx/tetrio/combo_12.mp3?v=baa6b16a',
		Combo13: 'assets/sfx/tetrio/combo_13.mp3?v=5daebd6d',
		Combo14: 'assets/sfx/tetrio/combo_14.mp3?v=a402bafe',
		Combo15: 'assets/sfx/tetrio/combo_15.mp3?v=37502dd9',
		Combo16: 'assets/sfx/tetrio/combo_16.mp3?v=0be906ff',
		B2B1: 'assets/sfx/tetrio/btb_1.mp3?v=f5e696e2',
		B2B2: 'assets/sfx/tetrio/btb_2.mp3?v=cc1f6c19',
		B2B3: 'assets/sfx/tetrio/btb_3.mp3?v=403ab8ef',
		B2BBreak: 'assets/sfx/tetrio/btb_break.mp3?v=e1d850cd',
		Danger: 'assets/sfx/tetrio/warning.mp3?v=613bb538',
		HyperDanger: 'assets/sfx/tetrio/hyperalert.mp3?v=64289af1',
		ComboBreak: 'assets/sfx/tetrio/combobreak.mp3?v=e40a77eb',
		Undo: 'assets/sfx/tetrio/undo.mp3?v=bb3a6442',
		Redo: 'assets/sfx/tetrio/redo.mp3?v=8aa002a1',
		Spin: 'assets/sfx/tetrio/spin.mp3?v=ecf529e1',
		SpinEnd: 'assets/sfx/tetrio/spinend.mp3?v=9072cca3',
		B2BChargeStart: 'assets/sfx/tetrio/b2bcharge_start.mp3?v=a33a0f32',
		B2BCharge1: 'assets/sfx/tetrio/b2bcharge_1.mp3?v=b72aa295',
		B2BCharge2: 'assets/sfx/tetrio/b2bcharge_2.mp3?v=0a176289',
		B2BCharge3: 'assets/sfx/tetrio/b2bcharge_3.mp3?v=7cc90c59',
		B2BCharge4: 'assets/sfx/tetrio/b2bcharge_4.mp3?v=71cec0ec',
		B2BChargeDistance1: 'assets/sfx/tetrio/b2bcharge_distance_1.mp3?v=5408e746',
		B2BChargeDistance2: 'assets/sfx/tetrio/b2bcharge_distance_2.mp3?v=88f1dfe8',
		B2BChargeDistance3: 'assets/sfx/tetrio/b2bcharge_distance_3.mp3?v=ee4a2f1e',
		B2BChargeBlast1: 'assets/sfx/tetrio/b2bcharge_blast_1.mp3?v=ac2083dd',
		B2BChargeBlast2: 'assets/sfx/tetrio/b2bcharge_blast_2.mp3?v=e6b53f2a',
		B2BChargeBlast3: 'assets/sfx/tetrio/b2bcharge_blast_3.mp3?v=a6f46418',
		B2BChargeBlast4: 'assets/sfx/tetrio/b2bcharge_blast_4.mp3?v=28ad7755',
		B2BChargeDanger: 'assets/sfx/tetrio/b2bcharge_danger.mp3?v=5b4b310a',
		GarbageOutLight: 'assets/sfx/tetrio/garbage_out_small.mp3?v=eb69ea05',
		GarbageOutMed: 'assets/sfx/tetrio/garbage_out_medium.mp3?v=5dd6c1a2',
		GarbageOutLarge: 'assets/sfx/tetrio/garbage_out_large.mp3?v=383e69fd',
		GarbageInLight: 'assets/sfx/tetrio/garbage_in_small.mp3?v=c59bb7c0',
		GarbageInMed: 'assets/sfx/tetrio/garbage_in_medium.mp3?v=00251c8d',
		GarbageInLarge: 'assets/sfx/tetrio/garbage_in_large.mp3?v=e044c69e',
		GarbageWindup1: 'assets/sfx/tetrio/garbagewindup_1.mp3?v=51daa93b',
		GarbageWindup2: 'assets/sfx/tetrio/garbagewindup_2.mp3?v=ab1ed989',
		GarbageWindup3: 'assets/sfx/tetrio/garbagewindup_3.mp3?v=02a4394c',
		GarbageWindup4: 'assets/sfx/tetrio/garbagewindup_4.mp3?v=095cfd64',
		GarbageRise: 'assets/sfx/tetrio/garbagerise.mp3?v=3d0a38b7',
		GarbageSmash: 'assets/sfx/tetrio/garbagesmash.mp3?v=9d4c59e3',
		Counter: 'assets/sfx/tetrio/counter.mp3?v=ffb3aabe',
		Impact: 'assets/sfx/tetrio/impact.mp3?v=8b1aaf2e',
		Exchange: 'assets/sfx/tetrio/exchange.mp3?v=51775a3c',
		Offset: 'assets/sfx/tetrio/offset.mp3?v=4de2a465',
		ProtectedSmall: 'assets/sfx/tetrio/protected_small.mp3?v=00c744e9',
		ProtectedMedium: 'assets/sfx/tetrio/protected_medium.mp3?v=394d5331',
		ProtectedLarge: 'assets/sfx/tetrio/protected_large.mp3?v=67ca8a06',
		Death: 'assets/sfx/tetrio/death.mp3?v=daedb593',
		Victory: 'assets/sfx/tetrio/victory.mp3?v=551b9ef4',
		LoseStock: 'assets/sfx/tetrio/losestock.mp3?v=b28ece6e',
		LevelUp: 'assets/sfx/tetrio/levelup.mp3?v=2e2a5209',
		Level10: 'assets/sfx/tetrio/level10.mp3?v=2786499f',
		Level100: 'assets/sfx/tetrio/level100.mp3?v=d69c5e4e',
		Level500: 'assets/sfx/tetrio/level500.mp3?v=d337e598',
		RatingRaise: 'assets/sfx/tetrio/ratingraise.mp3?v=d3b6ee73',
		RatingLower: 'assets/sfx/tetrio/ratinglower.mp3?v=aec99e0c',
		RankRaise: 'assets/sfx/tetrio/rankraise.mp3?v=76275f8c',
		RankLower: 'assets/sfx/tetrio/ranklower.mp3?v=5c67d844',
		PersonalBest: 'assets/sfx/tetrio/personalbest.mp3?v=29341a8f',
		WorldRecord: 'assets/sfx/tetrio/worldrecord.mp3?v=8888be08',
		Achievement1: 'assets/sfx/tetrio/achievement_1.mp3?v=3165108e',
		Achievement2: 'assets/sfx/tetrio/achievement_2.mp3?v=e8d1853b',
		Achievement3: 'assets/sfx/tetrio/achievement_3.mp3?v=6c62ca62',
		Supporter: 'assets/sfx/tetrio/supporter.mp3?v=0c2c1d76',
		PurchaseStart: 'assets/sfx/tetrio/purchase_start.mp3?v=145ba9e6',
		ShowScore: 'assets/sfx/tetrio/showscore.mp3?v=e57388e2',
		ScoreSlideIn: 'assets/sfx/tetrio/scoreslide_in.mp3?v=a2113a25',
		ScoreSlideOut: 'assets/sfx/tetrio/scoreslide_out.mp3?v=1a6e0d7d',
		MatchIntro: 'assets/sfx/tetrio/matchintro.mp3?v=40765fe6',
		Countdown1: 'assets/sfx/tetrio/countdown1.mp3?v=fbb15daa',
		Countdown2: 'assets/sfx/tetrio/countdown2.mp3?v=c05b86c6',
		Countdown3: 'assets/sfx/tetrio/countdown3.mp3?v=d01b1a32',
		Countdown4: 'assets/sfx/tetrio/countdown4.mp3?v=56ee57ff',
		Countdown5: 'assets/sfx/tetrio/countdown5.mp3?v=9702d691',
		Go: 'assets/sfx/tetrio/go.mp3?v=ac36e8ba',
		Elim: 'assets/sfx/tetrio/elim.mp3?v=e593f043',
		Applause: 'assets/sfx/tetrio/applause.mp3?v=ce060e04',
		PartyReady: 'assets/sfx/tetrio/party_ready.mp3?v=2170405f',
		UserJoin: 'assets/sfx/tetrio/userjoin.mp3?v=a256cf0a',
		UserLeave: 'assets/sfx/tetrio/userleave.mp3?v=74ae4775',
	};

	const CLASSIC_FILES = {
		Move: 'assets/sfx/Move.wav?v=7a06b53c',
		Rotate: 'assets/sfx/Rotate.wav?v=abc17339',
		Hold: 'assets/sfx/Hold.wav?v=38c3a6d1',
		HardDrop: 'assets/sfx/HardDrop.wav?v=1952b7d9',
		SoftDrop: 'assets/sfx/SoftDrop.wav?v=d65a283f',
		LockDelay: 'assets/sfx/LockDelay.wav?v=361b2858',
		ClearQuad: 'assets/sfx/ClearTetra.wav?v=f48380fa',
		ClearSpin: 'assets/sfx/ClearTetra.wav?v=f48380fa',
		ClearB2B: 'assets/sfx/ClearTetra.wav?v=f48380fa',
		PerfectClear: 'assets/sfx/PerfectClear.wav?v=62fb36cf',
		GarbageLight: 'assets/sfx/GarbageLight.wav?v=c3273188',
		GarbageMed: 'assets/sfx/GarbageMed.wav?v=184bbae6',
		GarbageLarge: 'assets/sfx/GarbageLarge.wav?v=6166f662',
		IncomingLight: 'assets/sfx/IncomingLight.wav?v=33fbdab9',
		IncomingMed: 'assets/sfx/IncomingMed.wav?v=7d82d4ee',
		IncomingLarge: 'assets/sfx/IncomingLarge.wav?v=c2bc21e0',
		FinesseFault: 'assets/sfx/FinesseFault.wav?v=a260b135',
		SlowDown: 'assets/sfx/SlowDown.wav?v=65a72722',
		TSpin1: 'assets/sfx/TSpin1.wav?v=0173cf5f',
		TopOut: 'assets/sfx/TopOut.wav?v=b82c31c6',
		Finish: 'assets/sfx/Finish.wav?v=1b4aa530',
	};

	const PACKS = {
		tetrio: {
			id: 'tetrio',
			label: 'TETR.IO (official)',
			files: TETRIO_FILES,
			cues: true,
		},
		practice: {
			id: 'practice',
			label: 'Practice (Tetroblox)',
			files: PRACTICE_FILES,
			cues: true,
		},
		classic: {
			id: 'classic',
			label: 'Classic (game sounds only)',
			files: CLASSIC_FILES,
			cues: false,
		},
		custom: {
			id: 'custom',
			label: 'Custom (folder)',
			files: TETRIO_FILES,
			cues: true,
			custom: true,
		},
	};

	const ALIASES = {
		move: 'Move',
		rotate: 'Rotate',
		hold: 'Hold',
		harddrop: 'HardDrop',
		hard_drop: 'HardDrop',
		softdrop: 'SoftDrop',
		soft_drop: 'SoftDrop',
		lock: 'LockDelay',
		lockdelay: 'LockDelay',
		floor: 'LockDelay',
		clear: 'ClearLine',
		clearline: 'ClearLine',
		lineclear: 'ClearLine',
		clear1: 'ClearLine',
		clear2: 'ClearLine',
		clear3: 'ClearLine',
		clearquad: 'ClearQuad',
		clear4: 'ClearQuad',
		quad: 'ClearQuad',
		clearspin: 'ClearSpin',
		tspin: 'ClearSpin',
		spin: 'Spin',
		spinend: 'SpinEnd',
		clearbtb: 'ClearB2B',
		btb: 'ClearB2B',
		b2b: 'B2B1',
		allclear: 'PerfectClear',
		perfectclear: 'PerfectClear',
		pc: 'PerfectClear',
		combo: 'Combo1',
		combobreak: 'ComboBreak',
		hit: 'Hit',
		btb_break: 'B2BBreak',
		b2bbreak: 'B2BBreak',
		surge: 'B2BChargeBlast1',
		b2bcharge: 'B2BCharge1',
		b2bchargestart: 'B2BChargeStart',
		b2bchargedanger: 'B2BChargeDanger',
		danger: 'Danger',
		warning: 'Danger',
		hyperdanger: 'HyperDanger',
		hyperalert: 'HyperDanger',
		finesse: 'FinesseFault',
		finessefault: 'FinesseFault',
		slowdown: 'SlowDown',
		tspin1: 'TSpin1',
		topout: 'TopOut',
		gameover: 'GameOver',
		finish: 'Finish',
		undo: 'Undo',
		redo: 'Redo',
		garbage: 'GarbageMed',
		garbagelight: 'GarbageLight',
		garbagemed: 'GarbageMed',
		garbagelarge: 'GarbageLarge',
		incoming: 'IncomingMed',
		incominglight: 'IncomingLight',
		incomingmed: 'IncomingMed',
		incominglarge: 'IncomingLarge',
		damage: 'GarbageMed',
		damage_small: 'GarbageLight',
		damage_medium: 'GarbageMed',
		damage_large: 'GarbageLarge',
		damage_alert: 'IncomingMed',
		garbageout: 'GarbageOutMed',
		garbageoutlight: 'GarbageOutLight',
		garbageoutmed: 'GarbageOutMed',
		garbageoutlarge: 'GarbageOutLarge',
		garbagein: 'GarbageInMed',
		garbageinlight: 'GarbageInLight',
		garbageinmed: 'GarbageInMed',
		garbageinlarge: 'GarbageInLarge',
		garbagewindup: 'GarbageWindup1',
		garbagerise: 'GarbageRise',
		garbagesmash: 'GarbageSmash',
		counter: 'Counter',
		impact: 'Impact',
		exchange: 'Exchange',
		offset: 'Offset',
		protected: 'ProtectedMedium',
		protectedsmall: 'ProtectedSmall',
		protectedmedium: 'ProtectedMedium',
		protectedlarge: 'ProtectedLarge',
		death: 'Death',
		victory: 'Victory',
		losestock: 'LoseStock',
		levelup: 'LevelUp',
		level10: 'Level10',
		level100: 'Level100',
		level500: 'Level500',
		ratingraise: 'RatingRaise',
		ratinglower: 'RatingLower',
		rankraise: 'RankRaise',
		ranklower: 'RankLower',
		personalbest: 'PersonalBest',
		worldrecord: 'WorldRecord',
		achievement1: 'Achievement1',
		achievement2: 'Achievement2',
		achievement3: 'Achievement3',
		supporter: 'Supporter',
		purchasestart: 'PurchaseStart',
		showscore: 'ShowScore',
		scoreslidein: 'ScoreSlideIn',
		scoreslideout: 'ScoreSlideOut',
		matchintro: 'MatchIntro',
		countdown1: 'Countdown1',
		countdown2: 'Countdown2',
		countdown3: 'Countdown3',
		countdown4: 'Countdown4',
		countdown5: 'Countdown5',
		go: 'Go',
		elim: 'Elim',
		applause: 'Applause',
		partyready: 'PartyReady',
		userjoin: 'UserJoin',
		userleave: 'UserLeave',
	};

	function resolveAlias(base) {
		const combo = base.match(/^combo[_-]?(\d+)$/);
		if (combo) {
			const index = Math.max(1, Math.min(16, Number(combo[1]) || 1));
			return `Combo${index}`;
		}
		const btb = base.match(/^btb[_-]?(\d+)$/);
		if (btb) {
			const index = Math.max(1, Math.min(3, Number(btb[1]) || 1));
			return `B2B${index}`;
		}
		return ALIASES[base] || null;
	}

	function openDb() {
		return new Promise((resolve, reject) => {
			if (!root.indexedDB) {
				reject(new Error('IndexedDB is unavailable.'));
				return;
			}
			const request = root.indexedDB.open(DB_NAME, DB_VERSION);
			request.onupgradeneeded = () => {
				const db = request.result;
				if (!db.objectStoreNames.contains(STORE)) {
					db.createObjectStore(STORE);
				}
			};
			request.onsuccess = () => resolve(request.result);
			request.onerror = () => reject(request.error);
		});
	}

	function readAll(db) {
		return new Promise((resolve, reject) => {
			const transaction = db.transaction(STORE, 'readonly');
			const store = transaction.objectStore(STORE);
			const request = store.openCursor();
			const result = new Map();
			request.onsuccess = () => {
				const cursor = request.result;
				if (!cursor) {
					resolve(result);
					return;
				}
				result.set(cursor.key, cursor.value);
				cursor.continue();
			};
			request.onerror = () => reject(request.error);
		});
	}

	function writeAll(db, files) {
		return new Promise((resolve, reject) => {
			const transaction = db.transaction(STORE, 'readwrite');
			const store = transaction.objectStore(STORE);
			store.clear();
			for (const [name, file] of files) {
				store.put(file, name);
			}
			transaction.oncomplete = () => resolve();
			transaction.onerror = () => reject(transaction.error);
		});
	}

	function clearAll(db) {
		return new Promise((resolve, reject) => {
			const transaction = db.transaction(STORE, 'readwrite');
			transaction.objectStore(STORE).clear();
			transaction.oncomplete = () => resolve();
			transaction.onerror = () => reject(transaction.error);
		});
	}

	class SoundPack {
		constructor() {
			this.ctx = null;
			this.master = null;
			this.compressor = null;
			this.buffers = new Map();
			this.loading = new Map();
			this.customFiles = new Map();
			this.customBuffers = new Map();
			this.customReady = false;
			this.customLoading = null;
			this.settings = this.loadSettings();
			this.suppressed = false;
			this.suppressDepth = 0;
			this.voices = 0;
			this.maxVoices = 24;
			this.categories = new Map();
			this.categoryTokens = new Map();
			this.lastPlayed = new Map();
			this.danger = new Map();
			this.preloaded = false;
			this.listeners = new Set();
			this.initPromise = null;
			this.loadCustomFiles();
			if (root.addEventListener) {
				root.addEventListener('storage', (event) => {
					if (event.key !== STORAGE_KEY) return;
					this.settings = this.loadSettings();
					this.emitChange();
				});
				const resume = () => {
					this.resume();
				};
				root.addEventListener('pointerdown', resume, { once: true });
				root.addEventListener('keydown', resume, { once: true });
			}
		}

		loadSettings() {
			try {
				const raw = root.localStorage.getItem(STORAGE_KEY);
				if (!raw) return { pack: DEFAULT_PACK, cues: true };
				const parsed = JSON.parse(raw);
				return {
					pack: PACKS[parsed.pack] ? parsed.pack : DEFAULT_PACK,
					cues: parsed.cues !== false,
				};
			} catch (error) {
				return { pack: DEFAULT_PACK, cues: true };
			}
		}

		saveSettings() {
			try {
				root.localStorage.setItem(
					STORAGE_KEY,
					JSON.stringify(this.settings)
				);
			} catch (error) {
				// Storage can be unavailable; the in-memory settings still work.
			}
		}

		getSettings() {
			return { ...this.settings };
		}

		getPack() {
			return this.settings.pack;
		}

		setPack(id) {
			if (!PACKS[id]) return;
			this.settings.pack = id;
			this.saveSettings();
			this.preloaded = false;
			this.emitChange();
			this.resume();
		}

		setCues(enabled) {
			this.settings.cues = !!enabled;
			this.saveSettings();
			this.emitChange();
		}

		listPacks() {
			return Object.values(PACKS).map((pack) => ({
				id: pack.id,
				label: pack.label,
				cues: pack.cues,
			}));
		}

		onChange(listener) {
			if (typeof listener !== 'function') return () => {};
			this.listeners.add(listener);
			return () => this.listeners.delete(listener);
		}

		emitChange() {
			for (const listener of this.listeners) {
				try {
					listener(this.getSettings());
				} catch (error) {
					// A broken listener must not stop the others.
				}
			}
		}

		init() {
			if (this.ctx) return;
			const Ctx = root.AudioContext || root.webkitAudioContext;
			if (!Ctx) return;
			this.ctx = new Ctx();
			this.master = this.ctx.createGain();
			this.master.gain.value = 1;
			this.compressor = this.ctx.createDynamicsCompressor();
			this.compressor.threshold.value = -12;
			this.compressor.knee.value = 20;
			this.compressor.ratio.value = 4;
			this.compressor.attack.value = 0.003;
			this.compressor.release.value = 0.25;
			this.master.connect(this.compressor);
			this.compressor.connect(this.ctx.destination);
		}

		async resume() {
			if (!this.ctx) this.init();
			if (!this.ctx) return;
			if (this.ctx.state === 'suspended') {
				try {
					await this.ctx.resume();
				} catch (error) {
					// The browser may still block audio until a later gesture.
				}
			}
			if (!this.preloaded) {
				this.preloaded = true;
				this.preload();
			}
			if (this.settings.pack === 'custom' && this.customFiles.size) {
				this.loadCustomBuffers();
			}
		}

		async preload() {
			if (!this.ctx) return;
			const pack = PACKS[this.settings.pack] || PACKS[DEFAULT_PACK];
			const names = Object.keys(pack.files);
			const common = [
				'Move',
				'Rotate',
				'Hold',
				'HardDrop',
				'SoftDrop',
				'LockDelay',
				'ClearLine',
				'ClearQuad',
				'ClearSpin',
				'ClearB2B',
				'PerfectClear',
				'Combo1',
				'B2B1',
				'Danger',
				'HyperDanger',
				'Spin',
				'SpinEnd',
				'B2BChargeBlast1',
				'B2BChargeBlast2',
				'B2BChargeBlast3',
				'B2BChargeBlast4',
				'GarbageOutMed',
				'GarbageInMed',
				'Counter',
				'Impact',
			];
			for (const name of common) {
				if (names.includes(name)) await this.loadAsset(name);
			}
		}

		assetPath(name) {
			const pack = PACKS[this.settings.pack] || PACKS[DEFAULT_PACK];
			return pack.files[name] || null;
		}

		async loadAsset(name) {
			if (!this.ctx) return null;
			const path = this.assetPath(name);
			if (!path) return null;
			if (this.buffers.has(path)) return this.buffers.get(path);
			if (this.loading.has(path)) return this.loading.get(path);
			const promise = fetch(path)
				.then((response) => {
					if (!response.ok) throw new Error(`HTTP ${response.status}`);
					return response.arrayBuffer();
				})
				.then((data) => this.ctx.decodeAudioData(data))
				.then((buffer) => {
					this.buffers.set(path, buffer);
					return buffer;
				})
				.catch(() => null)
				.finally(() => this.loading.delete(path));
			this.loading.set(path, promise);
			return promise;
		}

		async loadCustomFiles() {
			if (this.customLoading) return this.customLoading;
			this.customLoading = (async () => {
				try {
					const db = await openDb();
					const files = await readAll(db);
					db.close();
					this.customFiles = files;
					this.customReady = true;
					this.emitChange();
				} catch (error) {
					this.customReady = true;
				}
			})();
			return this.customLoading;
		}

		async loadCustomBuffers() {
			if (!this.ctx) return;
			for (const [name, file] of this.customFiles) {
				if (this.customBuffers.has(name)) continue;
				try {
					const data = await file.arrayBuffer();
					const buffer = await this.ctx.decodeAudioData(data);
					this.customBuffers.set(name, buffer);
				} catch (error) {
					// Skip files the browser cannot decode.
				}
			}
		}

		async importFiles(fileList) {
			const files = Array.from(fileList || []);
			const matched = new Map();
			const skipped = [];
			let totalBytes = 0;
			for (const file of files) {
				if (!/\.(wav|ogg|mp3|m4a|aac|flac)$/i.test(file.name)) {
					skipped.push(file.name);
					continue;
				}
				const base = file.name.replace(/\.[^.]+$/, '').toLowerCase();
				const name = resolveAlias(base);
				if (!name) {
					skipped.push(file.name);
					continue;
				}
				if (totalBytes + file.size > MAX_CUSTOM_BYTES) {
					throw new Error('Custom pack is too large (max 20 MB).');
				}
				matched.set(name, file);
				totalBytes += file.size;
			}
			if (!matched.size) {
				throw new Error(
					'No matching sound files found. Name files like move.wav, clear.wav, combo_1.wav or danger.wav.'
				);
			}
			const db = await openDb();
			await writeAll(db, matched);
			db.close();
			this.customFiles = matched;
			this.customBuffers.clear();
			await this.resume();
			await this.loadCustomBuffers();
			this.settings.pack = 'custom';
			this.saveSettings();
			this.preloaded = false;
			this.emitChange();
			return { loaded: matched.size, skipped, totalBytes };
		}

		async clearCustom() {
			try {
				const db = await openDb();
				await clearAll(db);
				db.close();
			} catch (error) {
				// Clearing is best-effort.
			}
			this.customFiles.clear();
			this.customBuffers.clear();
			if (this.settings.pack === 'custom') {
				this.settings.pack = DEFAULT_PACK;
				this.saveSettings();
			}
			this.emitChange();
		}

		getCustomStatus() {
			let bytes = 0;
			for (const file of this.customFiles.values()) {
				bytes += file.size || 0;
			}
			return {
				count: this.customFiles.size,
				bytes,
				names: [...this.customFiles.keys()],
			};
		}

		canPlay() {
			return (
				!!this.ctx &&
				!this.suppressed &&
				this.voices < this.maxVoices
			);
		}

		stopCategory(category) {
			const source = this.categories.get(category);
			if (!source) return;
			this.categories.delete(category);
			try {
				source.stop();
			} catch (error) {
				// The source may already have ended.
			}
		}

		playBuffer(buffer, options = {}) {
			if (!this.canPlay()) return;
			const category = options.category || null;
			if (category) this.stopCategory(category);
			const source = this.ctx.createBufferSource();
			source.buffer = buffer;
			source.playbackRate.value = Math.max(
				0.5,
				Math.min(2, Number(options.rate) || 1)
			);
			const gain = this.ctx.createGain();
			const volume = Math.max(
				0,
				Math.min(2, Number(options.volume ?? 1))
			);
			if (volume <= 0) return;
			gain.gain.value = volume;
			source.connect(gain);
			const panner = this.ctx.createStereoPanner
				? this.ctx.createStereoPanner()
				: null;
			if (panner) {
				panner.pan.value = Math.max(
					-1,
					Math.min(1, Number(options.pan) || 0)
				);
				gain.connect(panner);
				panner.connect(this.master);
			} else {
				gain.connect(this.master);
			}
			const start = this.ctx.currentTime + (Number(options.startDelay) || 0);
			source.start(start);
			this.voices += 1;
			if (category) this.categories.set(category, source);
			source.onended = () => {
				this.voices = Math.max(0, this.voices - 1);
				if (category && this.categories.get(category) === source) {
					this.categories.delete(category);
				}
				try {
					source.disconnect();
					gain.disconnect();
					if (panner) panner.disconnect();
				} catch (error) {
					// Already disconnected.
				}
			};
		}

		play(name, options = {}) {
			if (!this.ctx) {
				this.init();
				if (!this.ctx) return;
			}
			if (this.ctx.state === 'suspended') {
				this.ctx.resume().catch(() => {});
			}
			const now = performance.now();
			const key = `${name}:${options.category || ''}`;
			const last = this.lastPlayed.get(key) || 0;
			if (now - last < 12) return;
			this.lastPlayed.set(key, now);

			const category = options.category || null;
			const token = category
				? (this.categoryTokens.get(category) || 0) + 1
				: 0;
			if (category) this.categoryTokens.set(category, token);

			const custom = this.customBuffers.get(name);
			if (custom) {
				this.playBuffer(custom, options);
				return;
			}
			const path = this.assetPath(name);
			if (!path) return;
			const buffer = this.buffers.get(path);
			if (buffer) {
				this.playBuffer(buffer, options);
				return;
			}
			this.loadAsset(name).then((loaded) => {
				if (!loaded) return;
				if (category && this.categoryTokens.get(category) !== token) {
					return;
				}
				this.playBuffer(loaded, options);
			});
		}

		playCue(name, options = {}) {
			if (!this.settings.cues) return;
			const pack = PACKS[this.settings.pack] || PACKS[DEFAULT_PACK];
			if (!pack.cues) return;
			this.play(name, {
				...options,
				category: options.category || 'cue',
			});
		}

		playDanger(key, level, options = {}) {
			const now = performance.now();
			const last = this.danger.get(key) || 0;
			if (now - last < 3000) return;
			this.danger.set(key, now);
			this.playCue(level === 'hyper' ? 'HyperDanger' : 'Danger', {
				...options,
				category: 'danger',
			});
		}

		setSuppressed(value) {
			if (value) {
				this.suppressDepth = (this.suppressDepth || 0) + 1;
			} else {
				this.suppressDepth = Math.max(
					0,
					(this.suppressDepth || 0) - 1
				);
			}
			this.suppressed = this.suppressDepth > 0;
			if (this.suppressed) {
				for (const category of [...this.categories.keys()]) {
					this.stopCategory(category);
				}
			}
		}
	}

	root.ZZSoundPack = new SoundPack();
})(typeof globalThis !== 'undefined' ? globalThis : this);
