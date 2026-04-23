import { useEffect, useState } from 'react';
import {
  App as AntdApp,
  Button,
  Card,
  Col,
  Empty,
  Input,
  Pagination,
  Row,
  Select,
  Space,
  Tag,
  Typography,
} from 'antd';
import { CopyOutlined, FireOutlined, HeartFilled, HeartOutlined, SearchOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { api, isUnauthorizedError } from '../../api';
import { useI18n } from '../../i18n';
import type { PublicTemplateSummary } from '../../types';

const { Title, Paragraph, Text } = Typography;

const PAGE_SIZE = 9;

const PublicGalleryPage: React.FC = () => {
  const { isEnglish } = useI18n();
  const { message } = AntdApp.useApp();
  const navigate = useNavigate();
  const [items, setItems] = useState<PublicTemplateSummary[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<'latest' | 'hottest' | 'favorites' | 'uses'>('hottest');
  const [loading, setLoading] = useState(false);

  const fetchItems = async () => {
    setLoading(true);
    try {
      const data = await api.getPublicTemplates({
        page,
        pageSize: PAGE_SIZE,
        query,
        sort,
      });
      setItems(data.items);
      setTotal(data.total);
    } catch (error) {
      if (isUnauthorizedError(error)) {
        return;
      }

      message.error(isEnglish ? 'Failed to load the public gallery.' : '公开模板广场加载失败。');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchItems();
  }, [isEnglish, message, page, query, sort]);

  const handleFavorite = async (template: PublicTemplateSummary) => {
    try {
      const updated = template.isFavorited
        ? await api.unfavoritePublicTemplate(template.id)
        : await api.favoritePublicTemplate(template.id);

      setItems((current) => current.map((item) => item.id === updated.id ? updated : item));
    } catch (error) {
      if (isUnauthorizedError(error)) {
        return;
      }

      message.error(isEnglish ? 'Failed to update favorite status.' : '收藏状态更新失败。');
    }
  };

  const handleCopy = async (templateId: string) => {
    try {
      const copied = await api.copyTemplate(templateId);
      message.success(isEnglish ? 'Template copied to My Templates.' : '模板已复制到我的模板。');
      navigate(`/rules?templateId=${encodeURIComponent(copied.id)}`);
    } catch (error) {
      if (isUnauthorizedError(error)) {
        return;
      }

      message.error(isEnglish ? 'Failed to copy this template.' : '复制模板失败。');
    }
  };

  return (
    <div data-testid="page-public-gallery">
      <Space direction="vertical" size={20} style={{ width: '100%' }}>
        <div>
          <Title level={2} style={{ marginBottom: 8 }}>
            {isEnglish ? 'Public Gallery' : '公开模板广场'}
          </Title>
          <Paragraph type="secondary" style={{ marginBottom: 0 }}>
            {isEnglish
              ? 'Browse templates shared by everyone. You can search, sort by popularity, favorite them, or copy one into your own library.'
              : '这里展示所有公开共享的模板。你可以搜索、按热度排序、收藏，或者复制到自己的模板库。'}
          </Paragraph>
        </div>

        <Card variant="borderless">
          <Space wrap style={{ width: '100%', justifyContent: 'space-between' }}>
            <Input
              prefix={<SearchOutlined />}
              placeholder={isEnglish ? 'Search by template name or description' : '按模板名称或说明搜索'}
              value={query}
              onChange={(event) => {
                setPage(1);
                setQuery(event.target.value);
              }}
              style={{ width: 320 }}
            />
            <Select
              value={sort}
              onChange={(value) => {
                setPage(1);
                setSort(value);
              }}
              style={{ width: 220 }}
              options={[
                { label: isEnglish ? 'Hottest First' : '热度优先', value: 'hottest' },
                { label: isEnglish ? 'Most Favorited' : '收藏最多', value: 'favorites' },
                { label: isEnglish ? 'Most Used' : '使用最多', value: 'uses' },
                { label: isEnglish ? 'Latest Updated' : '最近更新', value: 'latest' },
              ]}
            />
          </Space>
        </Card>

        {items.length === 0 && !loading ? (
          <Card variant="borderless">
            <Empty description={isEnglish ? 'No public templates found' : '暂无符合条件的公开模板'} />
          </Card>
        ) : (
          <>
            <Row gutter={[16, 16]}>
              {items.map((item) => (
                <Col xs={24} md={12} xl={8} key={item.id}>
                  <Card
                    loading={loading}
                    variant="borderless"
                    title={item.name}
                    extra={<Tag color="blue">{isEnglish ? 'Public' : '公开'}</Tag>}
                  >
                    <Space direction="vertical" size={12} style={{ width: '100%' }}>
                      <Paragraph ellipsis={{ rows: 3 }} style={{ minHeight: 66, marginBottom: 0 }}>
                        {item.description || (isEnglish ? 'No description yet.' : '暂未填写说明。')}
                      </Paragraph>
                      <Text type="secondary">
                        {isEnglish ? 'Author' : '作者'}: {item.ownerDisplayName}
                      </Text>
                      <Space wrap>
                        <Tag icon={<HeartOutlined />}>{item.favoriteCount}</Tag>
                        <Tag icon={<FireOutlined />}>{item.hotScore}</Tag>
                        <Tag>{isEnglish ? `Used ${item.useCount}` : `使用 ${item.useCount}`}</Tag>
                      </Space>
                      <Space>
                        <Button
                          icon={item.isFavorited ? <HeartFilled /> : <HeartOutlined />}
                          onClick={() => void handleFavorite(item)}
                        >
                          {item.isFavorited
                            ? isEnglish ? 'Favorited' : '已收藏'
                            : isEnglish ? 'Favorite' : '收藏'}
                        </Button>
                        <Button type="primary" icon={<CopyOutlined />} onClick={() => void handleCopy(item.id)}>
                          {isEnglish ? 'Copy to Mine' : '复制到我的模板'}
                        </Button>
                      </Space>
                    </Space>
                  </Card>
                </Col>
              ))}
            </Row>

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <Pagination
                current={page}
                pageSize={PAGE_SIZE}
                total={total}
                onChange={setPage}
                showSizeChanger={false}
              />
            </div>
          </>
        )}
      </Space>
    </div>
  );
};

export default PublicGalleryPage;
