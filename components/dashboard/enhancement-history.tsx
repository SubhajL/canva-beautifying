'use client';

import { useEffect, useMemo, useRef, useState, KeyboardEvent } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { 
  Search, 
  Filter, 
  Download, 
  Eye, 
  MoreVertical,
  ChevronLeft,
  ChevronRight,
  Calendar,
  FileText,
  SortAsc,
  SortDesc
} from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import { useEnhancements } from '@/hooks/use-enhancements';
import { useInfiniteEnhancements } from '@/hooks/use-infinite-enhancements';
import { Skeleton } from '@/components/ui/skeleton';
import Link from 'next/link';
import { cn } from '@/lib/utils';

type SortField = 'created_at' | 'title' | 'status';
type SortOrder = 'asc' | 'desc';

export function EnhancementHistory() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sortField, setSortField] = useState<SortField>('created_at');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const [fileType, setFileType] = useState<string>('all');
  const [datePreset, setDatePreset] = useState<string>('all');

  const fromDate = useMemo(() => {
    const now = new Date()
    if (datePreset === '7d') return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()
    if (datePreset === '30d') return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString()
    if (datePreset === '90d') return new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString()
    return undefined
  }, [datePreset])

  // Debounce search term (300ms)
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchTerm), 300)
    return () => clearTimeout(t)
  }, [searchTerm])

  const { items, loading, error, hasMore, fetchNext, totalCount } = useInfiniteEnhancements({
    limit: itemsPerPage,
    search: debouncedSearch,
    status: statusFilter === 'all' ? undefined : statusFilter,
    fileType: fileType === 'all' ? undefined : fileType,
    fromDate,
  })

  const handleSort = (field: SortField) => {
    if (field === sortField) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  const sentinelRef = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    const el = sentinelRef.current
    if (!el) return
    const observer = new IntersectionObserver((entries) => {
      const first = entries[0]
      if (first.isIntersecting && hasMore && !loading) {
        fetchNext()
      }
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [hasMore, loading, fetchNext])

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-success/10 text-success border-success/20';
      case 'processing':
        return 'bg-info/10 text-info border-info/20';
      case 'failed':
        return 'bg-error/10 text-error border-error/20';
      default:
        return 'bg-muted text-muted-foreground border-border';
    }
  };

  return (
    <Card id="enhancement-history" className="scroll-mt-8">
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <CardTitle>Enhancement History</CardTitle>
            <CardDescription>
              View and manage all your enhanced documents
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="gap-1">
              <FileText className="h-3 w-3" />
              {totalCount || 0} total
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className={"pt-0 " + (/* density */ (typeof document !== 'undefined' && document.body.dataset.density === 'compact' ? 'p-4' : 'p-6'))}>
        {/* Filters */}
        <div className={"flex flex-col sm:flex-row mb-6 " + ((typeof document !== 'undefined' && document.body.dataset.density === 'compact') ? 'gap-2' : 'gap-4')}>
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input
              placeholder="Search by title..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-[180px]">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="processing">Processing</SelectItem>
              <SelectItem value="failed">Failed</SelectItem>
            </SelectContent>
          </Select>
          <Select value={fileType} onValueChange={setFileType}>
            <SelectTrigger className="w-full sm:w-[180px]">
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="application/pdf">PDF</SelectItem>
              <SelectItem value="image/png">PNG</SelectItem>
              <SelectItem value="image/jpeg">JPEG</SelectItem>
              <SelectItem value="image/jpg">JPG</SelectItem>
              <SelectItem value="image/webp">WEBP</SelectItem>
            </SelectContent>
          </Select>
          <Select value={datePreset} onValueChange={setDatePreset}>
            <SelectTrigger className="w-full sm:w-[180px]">
              <SelectValue placeholder="Date" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Time</SelectItem>
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
              <SelectItem value="90d">Last 90 days</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Table */}
        {loading && (!items || items.length === 0) ? (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        ) : error ? (
          <div className="text-center py-8">
            <p className="text-muted-foreground">Failed to load history</p>
            <Button variant="outline" size="sm" onClick={() => refetch()} className="mt-2">
              Try Again
            </Button>
          </div>
        ) : !items || items.length === 0 ? (
          <div className="text-center py-12">
            <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground">No enhancements found</p>
          </div>
        ) : (
          <>
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 p-0 font-medium hover:bg-transparent"
                        onClick={() => handleSort('title')}
                      >
                        Document
                        {sortField === 'title' && (
                          sortOrder === 'asc' ? 
                            <SortAsc className="ml-2 h-4 w-4" /> : 
                            <SortDesc className="ml-2 h-4 w-4" />
                        )}
                      </Button>
                    </TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 p-0 font-medium hover:bg-transparent"
                        onClick={() => handleSort('status')}
                      >
                        Status
                        {sortField === 'status' && (
                          sortOrder === 'asc' ? 
                            <SortAsc className="ml-2 h-4 w-4" /> : 
                            <SortDesc className="ml-2 h-4 w-4" />
                        )}
                      </Button>
                    </TableHead>
                    <TableHead>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 p-0 font-medium hover:bg-transparent"
                        onClick={() => handleSort('created_at')}
                      >
                        Date
                        {sortField === 'created_at' && (
                          sortOrder === 'asc' ? 
                            <SortAsc className="ml-2 h-4 w-4" /> : 
                            <SortDesc className="ml-2 h-4 w-4" />
                        )}
                      </Button>
                    </TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((enhancement) => (
                    <TableRow 
                      key={enhancement.id}
                      className="cursor-pointer hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                      onClick={() => router.push(`/app/results/${enhancement.id}`)}
                      onKeyDown={(e: KeyboardEvent<HTMLTableRowElement>) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          router.push(`/app/results/${enhancement.id}`)
                        }
                      }}
                      tabIndex={0}
                      aria-label={`View results for ${enhancement.title || 'document'}`}
                      data-testid={`history-row-${enhancement.id}`}
                    >
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className={(typeof document!=='undefined' && document.body.dataset.density==='compact' ? 'h-9 w-9' : 'h-10 w-10') + " rounded bg-muted flex items-center justify-center"}>
                            <FileText className="h-5 w-5 text-muted-foreground" />
                          </div>
                          <div>
                            <p className="font-medium">{enhancement.title}</p>
                            <p className="text-sm text-muted-foreground">
                              {enhancement.file_size ? 
                                `${(enhancement.file_size / 1024 / 1024).toFixed(2)} MB` : 
                                'Unknown size'
                              }
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {enhancement.enhancement_type && (
                          <Badge variant="outline" className="capitalize">
                            {enhancement.enhancement_type}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge 
                          variant="outline"
                          className={cn("capitalize", getStatusColor(enhancement.status))}
                        >
                          {enhancement.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2 text-sm">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          <span className="text-muted-foreground">
                            {format(new Date(enhancement.created_at), 'MMM d, yyyy')}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          {formatDistanceToNow(new Date(enhancement.created_at), { 
                            addSuffix: true 
                          })}
                        </p>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button asChild size="sm" variant="outline" className="mr-2">
                          <Link href={`/app/results/${enhancement.id}`} onClick={(e) => e.stopPropagation()}>View</Link>
                        </Button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" onClick={(e) => e.stopPropagation()}>
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem asChild>
                              <Link href={`/app/results/${enhancement.id}`} onClick={(e) => e.stopPropagation()}>
                                <Eye className="mr-2 h-4 w-4" />
                                View Details
                              </Link>
                            </DropdownMenuItem>
                            {enhancement.enhanced_url && (
                              <DropdownMenuItem asChild>
                                <a href={enhancement.enhanced_url} download onClick={(e) => e.stopPropagation()}>
                                  <Download className="mr-2 h-4 w-4" />
                                  Download
                                </a>
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}

                </TableBody>
              </Table>
            </div>
            {/* Infinite scroll sentinel */}
            <div ref={sentinelRef} className="h-8 flex items-center justify-center text-xs text-muted-foreground">
              {hasMore ? 'Loading more…' : `End of results (${totalCount ?? items.length} total)`}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
