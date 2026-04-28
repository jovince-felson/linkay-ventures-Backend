import session from '../models/session.model.js';
import refreshToken from '../models/refresh_token.model.js';
import { RESPONSE_CODES, logger, decryptId } from 'rhoam-shared-utils';
import { Op } from 'sequelize';

export const SessionManage = async (req, res, next) => {
    try {
        const { user_id, session_id, device_name, device_id } = req.body;

        const decrypted_user_id = decryptId(user_id);
        const decrypted_session_id = decryptId(session_id);

        const otherSessions = await session.findAll({
            where: {
                user_id: decrypted_user_id,
                device_id: device_id,
                device_name: device_name,
                revoked: false,
                id: {
                    [Op.ne]: decrypted_session_id
                }
            },
            attributes: ['id']
        });

        if (!otherSessions.length) {
            return next();
        }

        const sessionIdsToRevoke = otherSessions.map(s => s.id);

        await session.update(
            { revoked: true },
            {
                where: {
                    id: {
                        [Op.in]: sessionIdsToRevoke
                    }
                }
            }
        );

        await refreshToken.update(
            { revoked: true },
            {
                where: {
                    session_id: {
                        [Op.in]: sessionIdsToRevoke
                    }
                }
            }
        );

        return next();

    } catch (exception) {
        logger.error('Session Check Error', exception);
        return res.status(500).json({
            success: false,
            response_code: RESPONSE_CODES.SERVER_ERROR,
            message: 'Something went wrong, Please Try Again Later..!',
            error: exception.message
        });
    }
};
