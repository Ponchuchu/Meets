import {create} from 'zustand';
import {persist} from 'zustand/middleware';
import {deviceStorage} from '../state/storage';
export const useRobotConfig=create<{model:string;days:string;limit:string;topics:string[];set:(p:Partial<{model:string;days:string;limit:string;topics:string[]}>)=>void}>()(persist(set=>({model:'gemini-2.5-flash',days:'7',limit:'40',topics:['music','standup','cinema','art','food','sport'],set:p=>set(p)}),{name:'ryadom-robot-options',storage:deviceStorage()}));
