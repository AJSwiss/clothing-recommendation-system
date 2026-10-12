import request from 'supertest';
import {jest} from '@jest/globals';
import {sign} from './auth.js';

const query = jest.fn();
jest.unstable_mockModule('./db.js', () => ({query}));
const {default: app} = await import('./app.js');

beforeEach(() => query.mockReset());

describe('database-backed API contracts', () => {
  test('reports service health without querying the database', async () => {
    const response = await request(app).get('/api/health');
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ok: true});
    expect(query).not.toHaveBeenCalled();
  });

  test('rejects invalid registration before issuing an insert', async () => {
    const response = await request(app)
      .post('/api/auth/register')
      .send({email: 'not-an-email', firstName: '', password: 'short'});
    expect(response.status).toBe(400);
    expect(response.body.error).toMatch(/valid email/i);
    expect(query).not.toHaveBeenCalled();
  });

  test('writes normalized preferences with the authenticated user id', async () => {
    query.mockResolvedValueOnce({rows: [{user_id: 'user-1', preferred_colors: ['black']}]});
    const response = await request(app)
      .post('/api/user/preferences')
      .set('Authorization', `Bearer ${sign('user-1')}`)
      .send({colors: [' Black ', 'BLACK'], shirtStyles: ['T-Shirt'], pantStyles: ['straight-leg'], materials: ['Cotton']});

    expect(response.status).toBe(200);
    expect(query).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO user_preferences'), [
      'user-1', ['black', 'black'], ['t-shirt'], ['straight-leg'], ['cotton']
    ]);
  });
});
