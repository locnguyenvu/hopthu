export function Header2({children, title}) {
  return <>
    <div class='w-full p-3 shadow-sm mb-5'>
      <h1>{title ?? 'Title'}</h1>
    </div>
    {children}
  </>
}
