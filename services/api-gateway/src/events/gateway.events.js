import { Topics, Keys } from "linkay-shared-utils";


const eventHandlers = {

};


export async function routeGatewayEvent(key, data) {
    const handler = eventHandlers[key];
    if (handler) {
        await handler(data);
    } else {
        console.warn(`No handler found for event key: ${key}`);
    }
}
