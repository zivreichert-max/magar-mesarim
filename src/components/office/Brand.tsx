import s from './Office.module.css';

// The site's mark: the Bonim Mehadash square + the product name, laid out
// like the בוט-נים brand block so the two tools read as one family.
export default function Brand() {
  return (
    <div className={s.brand}>
      <div className={s.logo}>{'בונים\nמחדש'}</div>
      <div>
        <div className={s.brandName}>הלשכה</div>
        <div className={s.brandSub}>מבית בונים מחדש</div>
      </div>
    </div>
  );
}
