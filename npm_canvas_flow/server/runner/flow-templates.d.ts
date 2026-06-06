export declare function getCanvasFlowTemplates(): {
    id: string;
    name: string;
    segment: string;
    description: string;
    channel: string;
    config: {
        startStepId: string;
        steps: {
            id: string;
            type: string;
            title: string;
            instruction: string;
            position: {
                x: number;
                y: number;
            };
            tags: any[];
        }[];
        edges: {
            id: string;
            source: any;
            target: any;
        }[];
        title: string;
        responseName: string;
        execute: string;
        model: string;
        llmProvider: string;
        channel: "webWidget" | "whatsapp";
        isMainFlow: boolean;
        webWidget: {
            primaryColor: string;
            accentColor: string;
            assistantName: string;
            subtitle: string;
            welcomeMessage: string;
            placeholder: string;
            bubbleLabel: string;
            avatarText: string;
            openByDefault: boolean;
            position: string;
        };
        whatsapp: {
            provider: string;
            deliveryMode: string;
            verifyToken: string;
            phoneNumberId: string;
            accessToken: string;
            graphApiVersion: string;
            autoReply: boolean;
        };
        turnHistoricMessages: number;
    };
}[];
