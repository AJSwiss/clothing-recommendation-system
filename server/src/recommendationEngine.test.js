import {scoreItem} from './recommendationEngine.js';
test('scores explicit matches from zero to one hundred',()=>{
  const item={color:'black',style:'t-shirt',material:'cotton'};
  expect(scoreItem(item,{preferred_colors:['black'],preferred_shirt_styles:['t-shirt'],preferred_materials:['cotton']})).toBe(65);
  expect(scoreItem(item,{}, {dislikes:[item]})).toBe(0);
});
