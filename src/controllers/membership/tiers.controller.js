const { query } = require('../../config/db');
const { success, fail } = require('../../helpers/response');

const list = async (_req, res, next) => {
  try {
    const rows = await query(
      `SELECT id, name, percentOfCashBack, accumulationAmount,
              minAmount, maxPercentOfBill, expDate, status, inputDate, updateDate
       FROM tier
       WHERE presence = 1 AND status = 1
       ORDER BY id ASC`
    );

    return success(res, { rows }, 'Membership tiers fetched');
  } catch (err) {
    return next(err);
  }
};

const getProgressPayload = async (memberId) => {
  const members = await query(
    `SELECT m.id, m.tierId,
            COALESCE(currentTier.name, '') AS currentTierName,
            COALESCE(currentTier.requirementTransactionOfTier, 0) AS currentTierRequirement
     FROM members m
     LEFT JOIN tier currentTier ON currentTier.id = m.tierId
     WHERE m.id = ? AND m.presence = 1
     LIMIT 1`,
    [memberId]
  );

  const member = members[0] || null;

  if (!member) {
    return null;
  }

  const transactionRows = await query(
    `SELECT COALESCE(SUM(totalAmount), 0) AS totalTransaction
     FROM transaction
     WHERE memberId = ? AND archived = 0 AND presence = 1`,
    [String(memberId)]
  );

  const totalTransaction = Number(transactionRows[0]?.totalTransaction || 0);
  const currentTierRequirement = Number(member.currentTierRequirement || 0);

  const nextRows = await query(
    `SELECT id, name, requirementTransactionOfTier
     FROM tier
     WHERE presence = 1
       AND status = 1
       AND requirementTransactionOfTier > ?
     ORDER BY requirementTransactionOfTier ASC, id ASC
     LIMIT 1`,
    [currentTierRequirement]
  );

  const nextTier = nextRows[0] || null;
  const nextTierRequirement = Number(nextTier?.requirementTransactionOfTier || 0);
  const pointsToNextTier = nextTier
    ? Math.max(0, nextTierRequirement - totalTransaction)
    : 0;
  const reachedNextTier = Boolean(nextTier && totalTransaction >= nextTierRequirement);

  let progressPercent = 100;

  if (nextTier && nextTierRequirement > currentTierRequirement) {
    const span = nextTierRequirement - currentTierRequirement;
    const progress = totalTransaction - currentTierRequirement;
    progressPercent = Math.max(0, Math.min(100, (progress / span) * 100));
  }

  return {
    memberId,
    totalTransaction,
    currentTier: {
      id: Number(member.tierId || 0),
      name: member.currentTierName || '-',
      requirementTransactionOfTier: currentTierRequirement
    },
    nextTier: nextTier
      ? {
          id: Number(nextTier.id || 0),
          name: nextTier.name || '-',
          requirementTransactionOfTier: nextTierRequirement
        }
      : null,
    pointsToNextTier,
    reachedNextTier,
    canUpgrade: reachedNextTier,
    progressPercent,
    isHighestTier: !nextTier
  };
};

const progress = async (req, res, next) => {
  try {
    const memberId = req.user?.id;

    if (!memberId) {
      return fail(res, 'Member not authenticated', 401);
    }

    const payload = await getProgressPayload(memberId);

    if (!payload) {
      return fail(res, 'Member not found', 404);
    }

    return success(res, payload, 'Membership tier progress fetched');
  } catch (err) {
    return next(err);
  }
};

const upgrade = async (req, res, next) => {
  try {
    const memberId = req.user?.id;

    if (!memberId) {
      return fail(res, 'Member not authenticated', 401);
    }

    const payload = await getProgressPayload(memberId);

    if (!payload) {
      return fail(res, 'Member not found', 404);
    }

    if (payload.isHighestTier || !payload.nextTier) {
      return fail(res, 'Member already at highest tier', 400);
    }

    if (!payload.canUpgrade) {
      return fail(res, 'Requirement for next tier not reached', 400);
    }

    await query(
      `UPDATE members
       SET tierId = ?
       WHERE id = ? AND presence = 1`,
      [payload.nextTier.id, memberId]
    );
 
    const refreshed = await getProgressPayload(memberId);

    // await query(
    //   `UPDATE transaction
    //    SET archived = 1
    //    WHERE memberId = ? AND presence = 1`,
    //   [memberId]
    // );




    return success(res, {
      upgradedToTierId: payload.nextTier.id,
      upgradedToTierName: payload.nextTier.name,
      progress: refreshed
    }, 'Tier upgraded successfully');
  } catch (err) {
    return next(err);
  }
};

module.exports = { list, progress, upgrade };