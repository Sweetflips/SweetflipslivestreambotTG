import { ScheduleService } from '../../services/scheduleService.js';
import { logger } from '../../telemetry/logger.js';
export class ScheduleController {
    scheduleService;
    constructor(scheduleService) {
        this.scheduleService = scheduleService;
    }
    async getSchedule(request, reply) {
        try {
            const schedules = await this.scheduleService.getScheduleForWeek();
            return reply.send({
                success: true,
                data: schedules,
            });
        }
        catch (error) {
            logger.error('Failed to get schedule:', error);
            return reply.status(500).send({
                success: false,
                error: 'Failed to get schedule',
            });
        }
    }
    async getNextStreams(request, reply) {
        try {
            const { days = 7 } = request.query;
            const nextStreams = await this.scheduleService.getNextStreams(days);
            return reply.send({
                success: true,
                data: nextStreams,
            });
        }
        catch (error) {
            logger.error('Failed to get next streams:', error);
            return reply.status(500).send({
                success: false,
                error: 'Failed to get next streams',
            });
        }
    }
    async addScheduleEntry(request, reply) {
        try {
            const { dayOfWeek, streamNumber, eventTitle, createdBy } = request.body;
            if (typeof dayOfWeek !== 'number' || dayOfWeek < 0 || dayOfWeek > 6) {
                return reply.status(400).send({
                    success: false,
                    error: 'Day of week must be between 0 (Sunday) and 6 (Saturday)',
                });
            }
            if (typeof streamNumber !== 'number' || streamNumber < 1 || streamNumber > 2) {
                return reply.status(400).send({
                    success: false,
                    error: 'Stream number must be 1 or 2',
                });
            }
            if (!eventTitle || typeof eventTitle !== 'string') {
                return reply.status(400).send({
                    success: false,
                    error: 'Event title is required',
                });
            }
            const schedule = await this.scheduleService.addScheduleEntry(dayOfWeek, streamNumber, eventTitle, createdBy);
            return reply.send({
                success: true,
                data: schedule,
            });
        }
        catch (error) {
            logger.error('Failed to add schedule entry:', error);
            return reply.status(500).send({
                success: false,
                error: 'Failed to add schedule entry',
            });
        }
    }
    async removeScheduleEntry(request, reply) {
        try {
            const { dayOfWeek, streamNumber } = request.body;
            if (typeof dayOfWeek !== 'number' || dayOfWeek < 0 || dayOfWeek > 6) {
                return reply.status(400).send({
                    success: false,
                    error: 'Day of week must be between 0 (Sunday) and 6 (Saturday)',
                });
            }
            if (typeof streamNumber !== 'number' || streamNumber < 1 || streamNumber > 2) {
                return reply.status(400).send({
                    success: false,
                    error: 'Stream number must be 1 or 2',
                });
            }
            await this.scheduleService.removeScheduleEntry(dayOfWeek, streamNumber);
            return reply.send({
                success: true,
                message: 'Schedule entry removed successfully',
            });
        }
        catch (error) {
            logger.error('Failed to remove schedule entry:', error);
            return reply.status(500).send({
                success: false,
                error: 'Failed to remove schedule entry',
            });
        }
    }
    async getStreamTimes(request, reply) {
        try {
            const streamTimes = await this.scheduleService.getAllStreamTimes();
            return reply.send({
                success: true,
                data: streamTimes,
            });
        }
        catch (error) {
            logger.error('Failed to get stream times:', error);
            return reply.status(500).send({
                success: false,
                error: 'Failed to get stream times',
            });
        }
    }
}
//# sourceMappingURL=scheduleController.js.map