import { getToken } from '@auth/core/jwt';
import { getContext } from 'hono/context-storage';
import { shouldUseSecureCookies } from '@/app/api/utils/auth-cookie-policy';

export default function CreateAuth() {
	const auth = async () => {
		const c = getContext();
		const secureCookie = shouldUseSecureCookies({
			requestUrl: c.req.url,
			forwardedProtocol: c.req.header('x-forwarded-proto'),
			authUrl: process.env.AUTH_URL,
			nodeEnv: process.env.NODE_ENV,
		});
		const token = await getToken({
			req: c.req.raw,
			secret: process.env.AUTH_SECRET,
			secureCookie,
		});
		if (token) {
			return {
				user: {
					id: token.sub,
					email: token.email,
					name: token.name,
					image: token.picture,
				},
				expires: token.exp.toString(),
			};
		}
	};
	return {
		auth,
	};
}
