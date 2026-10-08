import DeptEntryPage, { type SearchParams } from '../../dept/entry-page';

export default function Page({ searchParams }: { searchParams: SearchParams }) {
  return <DeptEntryPage dept="electrical" searchParams={searchParams} />;
}
