import { FastifyRequest, FastifyReply } from 'fastify';
import { ScheduleService } from '../../services/scheduleService.js';
export declare class ScheduleController {
    private scheduleService;
    constructor(scheduleService: ScheduleService);
    getSchedule(request: FastifyRequest, reply: FastifyReply): Promise<never>;
    getNextStreams(request: FastifyRequest, reply: FastifyReply): Promise<never>;
    addScheduleEntry(request: FastifyRequest, reply: FastifyReply): Promise<never>;
    removeScheduleEntry(request: FastifyRequest, reply: FastifyReply): Promise<never>;
    getStreamTimes(request: FastifyRequest, reply: FastifyReply): Promise<never>;
}
//# sourceMappingURL=scheduleController.d.ts.map