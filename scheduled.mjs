import {schedule} from '@netlify/functions';
import {discover,submitReady} from './core.mjs';
export default schedule('0 */6 * * *',async()=>{await discover();await submitReady();});
