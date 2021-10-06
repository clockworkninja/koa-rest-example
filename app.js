const Koa = require('koa');
const Router = require('@koa/router');
const fs = require('fs');
const auth = require('basic-auth');
const bodyParser = require('koa-bodyparser');

const app = new Koa();
const router = new Router();
const dataFile = "data.json";

const user = { name: 'user', pass: 'secret'};
const admin = {name: 'admin', pass: 'secret'};

const isUser = function ({name, pass}) {
	try {
		return (name === user.name && pass === user.pass);
	} catch (e) {
		return false;
	};
}

const isAdmin = function ({name, pass}) {
	try {
		return (name === admin.name && pass === admin.pass);
	} catch (e) {
		return false;
	};
}

const getStats = function () {
	const raw = fs.readFileSync(dataFile, 'utf8');
	var stats = {
		numberOfCalls: 0,
		lastMessage: ""
	};
	try {
		stats = JSON.parse(raw);
	} catch (e) {
		//
	};
	
	return stats;
}	

const saveMessage = function ({message, from, to}) {
	var {numberOfCalls, lastMessage} = getStats();

	const log = fs.createWriteStream(dataFile, {flags: 'w'});
	
	var data = {
		numberOfCalls: ++numberOfCalls,
		lastMessage: message
	};
	
	log.write(JSON.stringify(data));
	log.end();
}

app.use(bodyParser());

app.use(async (ctx, next) => {
	try {
		await next();
	} catch (err) {
		if (401 == err.status) {
			ctx.status = 401;
			ctx.set('WWW-Authenticate', 'Basic');
			ctx.body = 'Authentication Error'
		} else {
			throw err;
		}
	}
});

router
	.get('/stats', (ctx) => {
		let creds = auth(ctx);
		
		if (creds && isAdmin(creds)) {
			ctx.status = 200;
			ctx.body = getStats();
		} else {
			ctx.throw(401, 'Access Denied')
		}
	})
	.post('/message', (ctx) => {
		let creds = auth(ctx);
		
		if (creds && (isAdmin(creds) || isUser(creds))) {
			saveMessage(ctx.request.body);
			ctx.status = 201;
		} else {
			ctx.throw(401, 'Access Denied')
		}
	}
);

app
	.use(router.routes())
	.use(router.allowedMethods());

app.listen(3000);