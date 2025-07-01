import amqp from 'amqplib';

export async function PublishMessage(exchange: string, routingKey: string, content: any, headers?: any) {
    try {
        const rabbitmqUrl = `amqp://${process.env.RABBITMQ_USER}:${process.env.RABBITMQ_PASSWORD}@${process.env.RABBITMQ_HOST}:5672`;
        const connection = await amqp.connect(rabbitmqUrl);
        const channel = await connection.createConfirmChannel();
        const message = Buffer.from(JSON.stringify(content));
        const sent = channel.publish(exchange, routingKey, message, {
            persistent: true,
            headers,
        }, (err, ok) => {
            if (err) {
                throw new Error(`could not publish message: ${err}`);
            } else {
                console.log(`Published message correctly: ${exchange} -> ${routingKey}`);
            }
        });
        if (!sent) {
            await connection.close();
            throw new Error('could not send message to buffer');
        }
        await channel.waitForConfirms();
        await connection.close();
    } catch (error) {
        throw new Error(`error in RabbitMQ operation: ${error.toString()}`);
    }
}
