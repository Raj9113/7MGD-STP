import DeptPage from '../dept/dept-page';
import type { SearchParams } from '../dept/entry-page';

export default function Page({ searchParams }: { searchParams: SearchParams }) {
  return <DeptPage dept="electrical" searchParams={searchParams} />;
}
