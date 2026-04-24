const { query } = require('../../config/db');
const { success, fail } = require('../../helpers/response');

const DEFAULT_PAGE_SIZE = 20;

const toNullableString = (value) => {
    if (value === undefined || value === null) return null;
    const text = String(value).trim();
    return text.length ? text : null;
};

const toId = (value) => {
    const parsed = Number(value);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : 0;
};

const getVoucherById = async (id) => {
    const rows = await query(
        `SELECT v.id, v.name, v.img, v.description, v.pointsRequired, v.pointsAmount,
            v.startDate, v.endDate, v.quota, v.presence, v.inputDate, v.updateDate,
            COUNT(vm.id) AS merchantCount
     FROM voucher v
     LEFT JOIN voucher_merchant vm ON vm.voucherId = v.id AND vm.presence = 1
     WHERE v.id = ? AND v.presence = 1
       AND (v.startDate IS NULL OR v.startDate <= CURDATE())
       AND (v.endDate IS NULL OR v.endDate >= CURDATE())
     GROUP BY v.id
     LIMIT 1`,
        [id]
    );

    return rows[0] || null;
};

const list = async (req, res, next) => {
    try {
        // Fetch all matching vouchers (no pagination)
        const search = toNullableString(req.query.search);

        const params = [];
        const whereClauses = [
            'v.presence = 1',
            '(v.startDate IS NULL OR v.startDate <= CURDATE())',
            '(v.endDate IS NULL OR v.endDate >= CURDATE())'
        ];

        if (search) {
            whereClauses.push('(v.name LIKE ? OR v.description LIKE ?)');
            params.push(`%${search}%`, `%${search}%`);
        }

        const where = whereClauses.join(' AND ');

        const rows = await query(
            `SELECT v.id, v.name, v.img, v.description, v.pointsRequired, v.pointsAmount,
                    v.startDate, v.endDate, v.quota, v.inputDate, v.updateDate,
                    COUNT(vm.id) AS merchantCount
             FROM voucher v
             LEFT JOIN voucher_merchant vm ON vm.voucherId = v.id AND vm.presence = 1
             WHERE ${where}
             GROUP BY v.id
             ORDER BY v.id DESC`,
            params
        );

        const normalizedRows = rows.map((row) => ({
            ...row,
            merchantScope: Number(row.merchantCount) > 0 ? 'selected' : 'global'
        }));

        const total = normalizedRows.length;

        return success(res, {
            total,
            rows: normalizedRows
        }, 'Vouchers fetched for member');
    } catch (err) {
        return next(err);
    }
};

const detail = async (req, res, next) => {
    try {
        const id = toId(req.params.id);

        if (!id) {
            return fail(res, 'Invalid voucher id', 422);
        }

        const voucher = await getVoucherById(id);

        if (!voucher) {
            return fail(res, 'Voucher not found', 404);
        }

        const selectedMerchants = await query(
            `SELECT vm.id, vm.voucherId, vm.marchantId AS merchantId,
              COALESCE(m.name, '-') AS merchantName,
              vm.quota, vm.inputDate, vm.updateDate
       FROM voucher_merchant vm
       LEFT JOIN merchant m ON m.id = vm.marchantId
       WHERE vm.voucherId = ? AND vm.presence = 1
       ORDER BY vm.id ASC`,
            [id]
        );

        return success(res, {
            voucher: {
                ...voucher,
                merchantScope: Number(voucher.merchantCount) > 0 ? 'selected' : 'global'
            },
            selectedMerchants
        }, 'Voucher detail fetched for member');
    } catch (err) {
        return next(err);
    }
};

module.exports = {
    list,
    detail
};
