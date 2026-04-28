import { Topics, Keys } from "rhoam-shared-utils";
import { handleFCMStore, handleUserOTPEmail, handleUserOTPMobile} from '../handlers/notification.handler.js';


const eventHandlers = {
    [Keys.USER_FCM_REGISTER]: handleFCMStore,
    [Keys.USER_EMAIL_OTP] : handleUserOTPEmail,
    [Keys.USER_MOBILE_OTP] : handleUserOTPMobile,
};


export async function routeNotificationEvent(key, data) {
    const handler = eventHandlers[key];
    if (handler) {
        await handler(data);
    } else {
        console.warn(`No handler found for event key: ${key}`);
    }
}
