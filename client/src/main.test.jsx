// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import {cleanup, fireEvent, render, screen, waitFor} from '@testing-library/react';
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

function response(body, ok = true) {
  return Promise.resolve({ok, json: () => Promise.resolve(body)});
}

function authenticatedFetch(url) {
  if (url === '/api/user/preferences') return response({preferred_colors: ['black']});
  if (url === '/api/faq') return response([]);
  if (url.startsWith('/api/recommendations')) return response({items: [item], total: 1, page: 1, limit: 40});
  if (url === '/api/outfits') return response([]);
  if (url.startsWith('/api/items/')) return response({item, similar: []});
  if (url === '/api/discover/next') return response(item);
  if (url === '/api/discover/swipe') return response({ok: true, next: item});
  return response({});
}

beforeEach(() => {
  localStorage.setItem('token', 'test-token');
  vi.stubGlobal('fetch', vi.fn(authenticatedFetch));
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  localStorage.clear();
  vi.restoreAllMocks();
});

function requestBody(call) {
  return JSON.parse(call[1].body);
}

describe('authentication flows', () => {
  it('creates an account and moves to onboarding', async () => {
    localStorage.clear();
    fetch.mockImplementation(url => {
      if (url === '/api/auth/register') return response({token: 'new-token'});
      if (url === '/api/user/preferences') return response(null);
      return response([]);
    });

    render(<App />);
    fireEvent.change(screen.getByPlaceholderText('First name'), {target: {value: 'Alex'}});
    fireEvent.change(screen.getByPlaceholderText('Email'), {target: {value: 'alex@example.com'}});
    fireEvent.change(screen.getByPlaceholderText('Password (8+ characters)'), {target: {value: 'password123'}});
    fireEvent.click(screen.getByRole('button', {name: 'Create account'}));

    await screen.findByRole('heading', {name: 'What feels like you?'});
    expect(localStorage.getItem('token')).toBe('new-token');
    const registration = fetch.mock.calls.find(([url]) => url === '/api/auth/register');
    expect(requestBody(registration)).toEqual({firstName: 'Alex', email: 'alex@example.com', password: 'password123'});
  });

  it('logs in and loads the authenticated application', async () => {
    localStorage.clear();
    fetch.mockImplementation(url => {
      if (url === '/api/auth/login') return response({token: 'login-token'});
      if (url === '/api/user/preferences') return response({preferred_colors: ['black']});
      return authenticatedFetch(url);
    });

    render(<App />);
    fireEvent.click(screen.getByRole('button', {name: 'Already have an account? Sign in'}));
    fireEvent.change(screen.getByPlaceholderText('Email'), {target: {value: 'alex@example.com'}});
    fireEvent.change(screen.getByPlaceholderText('Password (8+ characters)'), {target: {value: 'password123'}});
    fireEvent.click(screen.getByRole('button', {name: 'Sign in'}));

    await screen.findByRole('button', {name: 'suggested'});
    expect(localStorage.getItem('token')).toBe('login-token');
    const login = fetch.mock.calls.find(([url]) => url === '/api/auth/login');
    expect(requestBody(login)).toEqual({email: 'alex@example.com', password: 'password123'});
  });
});

describe('navigation and session flows', () => {
  it('switches tabs and logs out', async () => {
    render(<App />);
    fireEvent.click(await screen.findByRole('button', {name: 'faq'}));
    expect(screen.getByRole('heading', {name: 'Good to know'})).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', {name: 'outfits'}));
    expect(screen.getByRole('heading', {name: 'Outfit studio'})).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', {name: 'Log out'}));
    expect(screen.getByRole('heading', {name: 'Find your next favorite.'})).toBeInTheDocument();
    expect(localStorage.getItem('token')).toBeNull();
  });
});

describe('item interactions', () => {
  it.each(['like', 'dislike'])('sends a %s action for the Discover item', async action => {
    render(<App />);
    fireEvent.click(await screen.findByRole('button', {name: action === 'like' ? 'Like item' : 'Dislike item'}));
    await waitFor(() => {
      const swipe = fetch.mock.calls.find(([url]) => url === '/api/discover/swipe');
      expect(swipe).toBeDefined();
      expect(swipe[1]).toEqual(expect.objectContaining({method: 'POST'}));
    }, {timeout: 1000});
    const swipe = fetch.mock.calls.find(([url]) => url === '/api/discover/swipe');
    expect(requestBody(swipe)).toEqual({itemId: item.id, action});
  });

  it('opens an expanded item, keeps the close control above it, and exits with the X', async () => {
    render(<App />);
    fireEvent.click(await screen.findByRole('button', {name: 'suggested'}));
    fireEvent.click(await screen.findByRole('article'));

    const close = await screen.findByRole('button', {name: 'Close expanded item'});
    expect(close).toHaveStyle({zIndex: '1'});
    fireEvent.click(close);
    await waitFor(() => expect(screen.queryByRole('button', {name: 'Close expanded item'})).not.toBeInTheDocument());
  });

  it('exits the expanded item when the overlay is clicked', async () => {
    render(<App />);
    fireEvent.click(await screen.findByRole('button', {name: 'suggested'}));
    fireEvent.click(await screen.findByRole('article'));
    await screen.findByRole('button', {name: 'Close expanded item'});

    fireEvent.click(document.querySelector('.overlay'));
    await waitFor(() => expect(screen.queryByRole('button', {name: 'Close expanded item'})).not.toBeInTheDocument());
  });

  it('closes an expanded item when switching tabs', async () => {
    render(<App />);
    fireEvent.click(await screen.findByRole('button', {name: 'suggested'}));
    fireEvent.click(await screen.findByRole('article'));
    await screen.findByRole('button', {name: 'Close expanded item'});

    fireEvent.click(screen.getByRole('button', {name: 'faq'}));
    expect(screen.queryByRole('button', {name: 'Close expanded item'})).not.toBeInTheDocument();
    expect(screen.getByRole('heading', {name: 'Good to know'})).toBeInTheDocument();
  });
});
