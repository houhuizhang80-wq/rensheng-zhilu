/* ============================================================
 * 人生之路 本地离线后端 —— RPC 与云端函数处理器
 * 依赖 local-backend.js 的 window.__localBackend
 * ============================================================ */
(function () {
  'use strict';

  var LB = window.__localBackend;
  if (!LB) return;

  /* ---------- 辅助 ---------- */
  function ok(obj) { return LB.jsonResp(obj, 200); }
  function getSaveById(id) { return LB.getSaveById(id); }
  function saveRows(name) { return LB.table(name); }
  function saveTable(name, rows) { LB.saveTable(name, rows); }

  /* ============================================================
   * 登录门控 RPC —— 全部放行，直接进「建角色」
   * ============================================================ */
  LB.registerRpc('is_current_admin', function () {
    return ok(false);
  });
  LB.registerRpc('current_admin_role', function () {
    return ok(null);
  });
  LB.registerRpc('player_has_real_save', function () {
    // 本地是否存在已建角色的存档
    var has = LB.listSaves().some(function (s) { return !s.needs_character_creation; });
    return ok(has);
  });
  LB.registerRpc('has_approved_temp_appeal', function () {
    // 直接放行到建角色
    return ok(true);
  });
  LB.registerRpc('get_code_system_enabled', function () {
    // 返回 false 表示无需测试码系统，直接进建角色
    return ok(false);
  });
  LB.registerRpc('get_my_test_code_status', function () {
    return ok({ approval_status: 'approved', has_code: true, code: 'OFFLINE' });
  });
  LB.registerRpc('get_test_code_schedule', function () {
    return ok(null);
  });
  LB.registerRpc('register_with_test_code', function (body) {
    // 离线模式：直接返回 AUTO_APPROVED（自动通过，跳转 home）
    return ok("AUTO_APPROVED");
  });

  /* ============================================================
   * 存档相关 RPC
   * ============================================================ */
  LB.registerRpc('claim_database_slot', function (body) {
    // 离线模式不占任何在线区服，返回 null
    return ok(null);
  });
  LB.registerRpc('list_game_databases', function () {
    // 提供一个本地离线区服
    return ok([
      { code: 'offline', name: '本地离线', is_active: true, region: 'local' }
    ]);
  });
  LB.registerRpc('get_selected_database_code', function () {
    return ok(null);
  });
  LB.registerRpc('player_check_name_sensitive', function (body) {
    // 游戏代码: const u = Boolean(data); true=违规。必须返回布尔 false 表示不违规
    return ok(false);
  });
  LB.registerRpc('player_check_create_save_name', function (body) {
    return ok({ ok: true });
  });
  LB.registerRpc('player_rename_save', function (body) {
    var save = body && body.save_id ? getSaveById(body.save_id) : null;
    if (save) {
      save.player_name = (body && body.name) || save.player_name;
      save.updated_at = new Date().toISOString();
      LB.saveTable('player_saves', LB.listSaves());
      return ok({ ok: true, name: save.player_name });
    }
    return ok({ ok: false, message: '存档不存在' });
  });
  LB.registerRpc('apply_training_bonus', function () {
    return ok({ ok: true });
  });

  /* ============================================================
   * 公告 / 运营
   * ============================================================ */
  LB.registerRpc('get_announcement', function () {
    return ok(null);
  });
  LB.registerRpc('record_daily_gain', function () {
    return ok(null);
  });

  /* 榜单类 RPC（离线返回空） */
  LB.registerRpc('get_leaderboard', function () {
    return ok({ entries: [], myRank: null, myScore: 0, total: 0 });
  });
  LB.registerRpc('get_my_rank', function () {
    return ok(null);
  });

  /* 管理类 RPC —— 离线全部返回空/假值 */
  var adminRPCs = [
    'admin_stats_overview', 'admin_account_stats', 'admin_registration_trend',
    'admin_top_active', 'admin_rank_distribution', 'admin_online_players',
    'admin_account_list', 'admin_promote_rank', 'admin_reset_password',
    'admin_toggle_ban', 'admin_preview_inactive', 'admin_delete_inactive',
    'admin_request_password_reset', 'admin_list_password_reset_requests',
    'admin_approve_password_reset', 'admin_reject_password_reset',
    'admin_set_player_password', 'admin_delete_player_account',
    'admin_get_player_password', 'admin_find_save_by_account',
    'admin_delete_account', 'admin_ban_account', 'admin_clear_player_save',
    'admin_get_save', 'admin_update_save_fields', 'admin_clear_cooldowns',
    'admin_create_redeem_code', 'list_redeem_codes', 'admin_send_push',
    'list_push_notifications', 'list_game_config', 'admin_save_config',
    'admin_scan_device_clusters', 'admin_scan_anomalies',
    'list_detection_rules', 'list_flagged_users', 'update_flagged_status',
    'toggle_detection_rule', 'admin_get_announcement',
    'admin_upsert_announcement', 'admin_scan_ip_clusters',
    'admin_list_audit', 'list_cleanup_logs', 'admin_database_overview',
    'admin_create_database', 'admin_update_database',
    'admin_toggle_database_active', 'admin_generate_test_codes',
    'admin_list_test_codes', 'admin_list_test_code_groups',
    'admin_clear_unused_test_codes', 'admin_rename_test_code_group',
    'admin_delete_test_code_group', 'admin_list_test_code_batches',
    'admin_log_batch_copy', 'admin_upsert_schedule',
    'admin_list_schedule_requests', 'admin_approve_schedule',
    'admin_reject_schedule', 'admin_delete_test_code_batch',
    'admin_rename_test_code_batch', 'admin_restore_account',
    'admin_purge_expired_accounts', 'list_archived_accounts',
    'admin_test_code_stats', 'admin_approval_stats',
    'admin_get_auto_approval', 'admin_today_system_rejected_count',
    'admin_set_auto_approval', 'admin_set_code_system',
    'admin_approval_list', 'admin_approve_user', 'admin_reject_user',
    'admin_batch_approve', 'admin_batch_reject',
    'admin_batch_approve_all_pending',
    'admin_cleanup_stale_placeholder_saves', 'admin_get_player_full',
    'run_game_cleanup', 'admin_submit_appeal', 'admin_list_appeals',
    'admin_approve_appeal', 'admin_reject_appeal',
    'admin_appeals_pending_count', 'admin_direct_approve_account',
    'admin_list_unapproved_accounts', 'admin_test_code_gen_stats',
    'admin_player_leaderboard', 'admin_list_player_names',
    'admin_rename_player', 'admin_list_sensitive_words',
    'admin_add_sensitive_word', 'admin_delete_sensitive_word',
    'admin_batch_add_sensitive_words', 'admin_list_banned_entities',
    'admin_unban_entity', 'admin_banned_entities_stats',
    'submit_ban_appeal', 'admin_list_ban_appeals',
    'admin_review_ban_appeal', 'admin_list_npc_names',
    'admin_add_npc_name_full', 'admin_delete_npc_name_full',
    'admin_import_npc_names', 'admin_list_npc_names_in_use',
    'admin_sync_npc_names_from_saves', 'admin_list_temp_appeals',
    'admin_review_temp_appeal', 'admin_approve_all_temp_appeals',
    'admin_disable_test_codes', 'get_system_config',
    'player_can_create_save', 'player_apply_temp_appeal',
    'admin_list_announcements', 'admin_delete_announcement'
  ];
  adminRPCs.forEach(function (name) {
    LB.registerRpc(name, function () {
      // 尽量返回客户端能容忍的结构
      return ok(null);
    });
  });

  /* ============================================================
   * 云端函数
   * ============================================================ */

  /* ---- 申诉（离线直接通过） ---- */
  LB.registerFn('submit-temp-appeal', function (body) {
    return ok({ ok: true, created_at: new Date().toISOString() });
  });

  /* ---- 排行榜（离线返回空） ---- */
  LB.registerFn('get-leaderboard', function () {
    return ok({ entries: [], myRank: null, myScore: 0, prevGap: null, total: 0 });
  });
  LB.registerFn('set-leaderboard-save', function () {
    return ok({ success: true });
  });
  LB.registerFn('claim-milestone', function (body) {
    return ok({ success: false, milestone: body && body.milestone, influence: 0, silver: 0, extra: null, alreadyClaimed: true });
  });

  /* ---- 民意行动（离线本地计算） ---- */
  LB.registerFn('execute_popular_action', function (body) {
    try {
      var saveId = body && body.saveId;
      var actionId = body && body.actionId;
      var save = saveId ? getSaveById(saveId) : null;
      if (!save) return ok({ success: false, error: '存档不存在' });

      // 从客户端配置表中找 action 配置（bundle 内定义 getConfigsByCategory）
      var cfg = null;
      var all = [];
      try {
        // 尝试从 bundle 暴露的全局配置获取（不可用时用 fallback）
        var globalCfg = window.__lifeRoadConfigs;
        if (globalCfg) all = globalCfg;
      } catch (e) {}
      if (!all.length) {
        all = findClientConfigs();
      }
      for (var i = 0; i < all.length; i++) {
        if (all[i].id === actionId) { cfg = all[i]; break; }
      }
      if (!cfg) {
        return ok({ success: true, message: '操作完成', popularChange: 2, newPopularSupport: (save.popular_support || 50) + 2, sideEffects: [], changes: {} });
      }
      var p = cfg.params || {};
      var gain = p.popularGain || 2;
      var old = save.popular_support || 50;
      var nv = Math.max(0, Math.min(100, old + gain));
      var changes = { popularSupport: gain };
      if (p.livelihoodGain) { changes.cityLivelihood = p.livelihoodGain; save.city_livelihood = Math.max(0, Math.min(100, (save.city_livelihood || 50) + p.livelihoodGain)); }
      if (p.meritGain) { changes.meritPoints = p.meritGain; save.merit_points = (save.merit_points || 0) + p.meritGain; }
      if (p.opinionReduction) { changes.opinion = -p.opinionReduction; }
      if (p.teamIntegrityGain) { changes.teamIntegrity = p.teamIntegrityGain; }
      save.popular_support = nv;
      save.popular_log = save.popular_log || [];
      save.popular_log.push({ day: save.game_days || 0, actionId: actionId, gain: gain });
      LB.saveTable('player_saves', LB.listSaves());
      return ok({
        success: true,
        message: cfg.name + ' 完成，民心 +' + gain,
        popularChange: gain,
        newPopularSupport: nv,
        sideEffects: [],
        changes: changes
      });
    } catch (e) {
      return ok({ success: false, error: String(e) });
    }
  });

  /* ---- 日常行动（核心，离线本地掷骰） ---- */
  LB.registerFn('execute_gameplay_action', function (body) {
    try {
      var saveId = body && body.saveId;
      var configId = body && body.configId;
      var amount = body && body.amount;
      var save = saveId ? getSaveById(saveId) : null;
      if (!save) return ok({ success: false, error: '存档不存在' });

      // 找配置
      var cfg = findConfigById(configId);
      if (!cfg) {
        // 未知配置：给一个通用成功响应，避免卡死
        return ok({
          success: true,
          message: '操作完成',
          roll: { value: 50, label: '顺利' },
          gain: { silver: 100, merit: 1 },
          gameOver: null
        });
      }
      var p = cfg.params || {};

      // 掷骰
      var successRate = typeof p.successRate === 'number' ? p.successRate : 1;
      var dice = Math.random();
      var success = dice < successRate;
      var rollVal = Math.floor(dice * 100);
      var rollLabel = success ? '成功' : (rollVal >= successRate * 100 - 5 ? '有惊无险' : '失败');
      var roll = { value: rollVal, label: rollLabel, success: success };

      // 计算收益
      var gain = {};
      if (cfg.category === 'bribery_channel' || cfg.category === 'power_rent' || cfg.category === 'embezzlement') {
        var amt = amount && amount > 0 ? amount : (p.gainMin || 0);
        if (!amount || amount <= 0) {
          amt = Math.floor((p.gainMin || 0) + Math.random() * ((p.gainMax || p.gainMin || 0) - (p.gainMin || 0)));
        }
        if (success) {
          gain.silver = Math.round(amt);
          save.silver = (save.silver || 0) + gain.silver;
          save.illicit_funds = (save.illicit_funds || 0) + gain.silver;
          var risk = p.risk || 0;
          save.risk_value = Math.min(100, (save.risk_value || 0) + risk);
          if (p.moral) save.moral_value = Math.max(0, (save.moral_value || 80) - p.moral);
        } else {
          gain.silver = 0;
          gain.loss = Math.round((p.gainMin || 0) * 0.3);
          save.silver = Math.max(0, (save.silver || 0) - gain.loss);
          save.risk_value = Math.min(100, (save.risk_value || 0) + (p.risk || 0) + 3);
        }
        var cooldown = p.cooldown || 0;
        save.gameplay_cooldowns = save.gameplay_cooldowns || {};
        save.gameplay_cooldowns[configId] = (save.game_days || 0) + cooldown;
        save.bribe_count = (save.bribe_count || 0) + 1;
        save.bribe_log = save.bribe_log || [];
        save.bribe_log.push({ gameDay: save.game_days || 0, configId: configId, amount: gain.silver || 0, success: success });
      } else if (cfg.category === 'popularity') {
        // 民意类（虽走 executePopularAction，这里兜底）
        var pg = p.popularGain || 2;
        gain.popularSupport = pg;
        save.popular_support = Math.max(0, Math.min(100, (save.popular_support || 50) + pg));
      } else {
        // 通用：给少量政绩
        gain.merit = 1;
        save.merit_points = (save.merit_points || 0) + 1;
      }

      save.updated_at = new Date().toISOString();
      LB.saveTable('player_saves', LB.listSaves());

      return ok({
        success: true,
        message: (success ? '操作成功' : '操作有风险') + '，' + cfg.name,
        roll: roll,
        gain: gain,
        gameOver: null
      });
    } catch (e) {
      return ok({ success: false, error: String(e) });
    }
  });

  /* ============================================================
   * 配置查找
   * ============================================================ */
  function findClientConfigs() {
    // 尝试从 React 组件外的全局配置读取；未暴露则返回空
    try {
      if (window.__lifeRoadConfigs) return window.__lifeRoadConfigs;
    } catch (e) {}
    return [];
  }
  function findConfigById(id) {
    var all = findClientConfigs();
    for (var i = 0; i < all.length; i++) {
      if (all[i].id === id) return all[i];
    }
    return null;
  }

  /* 尝试捕获 bundle 内的配置：通过 monkey-patch getConfigsByCategory 不可行，
     改为在页面加载后由注入脚本将配置写入 window.__lifeRoadConfigs（见 local-config-hook.js） */
})();
