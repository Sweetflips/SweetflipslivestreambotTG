import { FastifyReply, FastifyRequest } from 'fastify';
import { LinkService } from './linkService.js';
export declare class LinkController {
    private linkService;
    constructor(linkService: LinkService);
    generateLinkCode(request: FastifyRequest<{
        Body: {
            userId: string;
        };
    }>, reply: FastifyReply): Promise<never>;
    verifyLinkCode(request: FastifyRequest<{
        Body: {
            code: string;
            kickName: string;
        };
    }>, reply: FastifyReply): Promise<never>;
    unlinkAccount(request: FastifyRequest<{
        Body: {
            userId: string;
        };
    }>, reply: FastifyReply): Promise<never>;
    getLinkStatus(request: FastifyRequest<{
        Params: {
            userId: string;
        };
    }>, reply: FastifyReply): Promise<never>;
    setCwalletHandle(request: FastifyRequest<{
        Body: {
            userId: string;
            handle: string;
        };
    }>, reply: FastifyReply): Promise<never>;
    getActiveLinkCodes(request: FastifyRequest<{
        Params: {
            telegramId: string;
        };
    }>, reply: FastifyReply): Promise<never>;
    validateLinkCode(request: FastifyRequest<{
        Params: {
            code: string;
        };
    }>, reply: FastifyReply): Promise<never>;
    cleanupExpiredCodes(request: FastifyRequest, reply: FastifyReply): Promise<never>;
}
//# sourceMappingURL=linkController.d.ts.map