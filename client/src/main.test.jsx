// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import {fireEvent, render, screen, waitFor} from '@testing-library/react';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {App} from './main.jsx';

const item = {
  id: '11111111-1111-1111-1111-111111111111',
  name: "Skechers Men's Shoe",
  category: 'shoes',
  subcategory: 'casual-shoes',
  color: 'black',
  material: 'leather',
  image_url: '/shoe.jpg',
  price: 50,
  match_score: 92
};

function response(body) {
  return Promise.resolve({ok: true, json: () => Promise.resolve(body)});
}

beforeEach(() => {
  localStorage.setItem('token', 'test-token');
  vi.stubGlobal('fetch', vi.fn(url => {
    if (url === '/api/user/preferences') return response({preferred_colors: ['black']});
    if (url === '/api/faq') return response([]);
    if (url.startsWith('/api/recommendations')) return response({items: [item], total: 1, page: 1, limit: 40});
    if (url === '/api/outfits') return response([]);
    if (url.startsWith('/api/items/')) return response({item, similar: []});
    return response({});
  }));
});

afterEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

describe('suggested item expanded view', () => {
  it('keeps the close control above the transformed summary', async () => {
    render(<App />);
    fireEvent.click(await screen.findByRole('button', {name: 'suggested'}));
    fireEvent.click(await screen.findByRole('article'));

    const close = await screen.findByRole('button', {name: 'Close expanded item'});
    expect(close).toHaveStyle({zIndex: '1'});
    fireEvent.click(close);
    await waitFor(() => expect(screen.queryByRole('button', {name: 'Close expanded item'})).not.toBeInTheDocument());
  });
});
