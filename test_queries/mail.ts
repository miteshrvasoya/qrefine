

export class MailService {
    async findUserByEmail(email: string) {
        const result = await equery;
        return result;
    }
    const equery = executeQuery("SELECT * FROM users LEFT JOIN emails ON users.id = emails.user_id WHERE emails.email = ? LIMIT 1", [email]);
}