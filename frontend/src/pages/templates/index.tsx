import { useEffect, useState } from 'react';
import {
  Button,
  Card,
  Popconfirm,
  Space,
  Switch,
  Table,
  Tag,
  Typography,
  message,
} from 'antd';
import { CopyOutlined, DeleteOutlined, EditOutlined, PlusOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { api } from '../../api';
import { useI18n } from '../../i18n';
import type { RuleTemplate } from '../../types';

const { Paragraph } = Typography;

const TemplatesManage: React.FC = () => {
  const { isEnglish } = useI18n();
  const [templates, setTemplates] = useState<RuleTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTemplateId, setActiveTemplateId] = useState<string | null>(null);
  const navigate = useNavigate();

  const fetchTemplates = async () => {
    setLoading(true);
    try {
      const data = await api.getTemplates();
      setTemplates(data);
    } catch {
      message.error(isEnglish ? 'Failed to load templates.' : '模板加载失败。');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchTemplates();
  }, []);

  const runAction = async (templateId: string, action: () => Promise<void>) => {
    setActiveTemplateId(templateId);
    try {
      await action();
    } finally {
      setActiveTemplateId(null);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await api.deleteTemplate(id);
      message.success(isEnglish ? 'Template deleted.' : '模板已删除。');
      await fetchTemplates();
    } catch {
      message.error(isEnglish ? 'Failed to delete the template.' : '删除模板失败。');
    }
  };

  const handleCopy = async (id: string) => {
    try {
      await api.copyTemplate(id);
      message.success(isEnglish ? 'Template copied.' : '模板已复制。');
      await fetchTemplates();
    } catch {
      message.error(isEnglish ? 'Failed to copy the template.' : '复制模板失败。');
    }
  };

  const handleApply = async (id: string) => {
    try {
      await api.applyTemplate(id);
      message.success(isEnglish ? 'Default template updated.' : '默认模板已更新。');
      await fetchTemplates();
      navigate(`/check?templateId=${encodeURIComponent(id)}`);
    } catch {
      message.error(isEnglish ? 'Failed to apply this template.' : '应用模板失败。');
    }
  };

  const handleVisibilityChange = async (template: RuleTemplate, checked: boolean) => {
    try {
      await api.updateTemplateVisibility(template.id, checked ? 'public' : 'private');
      message.success(
        checked
          ? isEnglish ? 'Template is now public.' : '模板已公开。'
          : isEnglish ? 'Template is now private.' : '模板已设为私有。'
      );
      await fetchTemplates();
    } catch {
      message.error(isEnglish ? 'Failed to update visibility.' : '更新可见性失败。');
    }
  };

  const columns = [
    {
      title: isEnglish ? 'Template' : '模板',
      dataIndex: 'name',
      key: 'name',
      render: (_text: string, record: RuleTemplate) => (
        <Space direction="vertical" size={4}>
          <Space>
            <span style={{ fontWeight: 600 }}>{record.name}</span>
            {record.isDefault && <Tag color="blue">{isEnglish ? 'Default' : '默认'}</Tag>}
            <Tag color={record.visibility === 'public' ? 'green' : 'default'}>
              {record.visibility === 'public'
                ? isEnglish ? 'Public' : '公开'
                : isEnglish ? 'Private' : '私有'}
            </Tag>
          </Space>
          <span style={{ color: '#8c8c8c' }}>{record.description || (isEnglish ? 'No description yet.' : '暂未填写说明。')}</span>
        </Space>
      ),
    },
    {
      title: isEnglish ? 'Shared' : '共享',
      key: 'visibility',
      width: 180,
      render: (_: unknown, record: RuleTemplate) => (
        <Switch
          checked={record.visibility === 'public'}
          checkedChildren={isEnglish ? 'Public' : '公开'}
          unCheckedChildren={isEnglish ? 'Private' : '私有'}
          loading={activeTemplateId === record.id}
          onChange={(checked) => void runAction(record.id, () => handleVisibilityChange(record, checked))}
        />
      ),
    },
    {
      title: isEnglish ? 'Activity' : '热度',
      key: 'activity',
      width: 220,
      render: (_: unknown, record: RuleTemplate) => (
        <Space wrap>
          <Tag>{isEnglish ? `Favorites ${record.favoriteCount}` : `收藏 ${record.favoriteCount}`}</Tag>
          <Tag>{isEnglish ? `Uses ${record.useCount}` : `使用 ${record.useCount}`}</Tag>
          <Tag>{isEnglish ? `Hot ${record.hotScore}` : `热度 ${record.hotScore}`}</Tag>
        </Space>
      ),
    },
    {
      title: isEnglish ? 'Updated' : '更新时间',
      dataIndex: 'updatedAt',
      key: 'updatedAt',
      width: 180,
      render: (value: string) => value.replace('T', ' ').slice(0, 19),
    },
    {
      title: isEnglish ? 'Actions' : '操作',
      key: 'actions',
      width: 260,
      render: (_: unknown, record: RuleTemplate) => (
        <Space size="small" wrap>
          <Button
            type="link"
            size="small"
            loading={activeTemplateId === record.id}
            onClick={() => void runAction(record.id, () => handleApply(record.id))}
          >
            {isEnglish ? 'Use' : '使用'}
          </Button>
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => navigate(`/rules?templateId=${encodeURIComponent(record.id)}`)}
          >
            {isEnglish ? 'Edit' : '编辑'}
          </Button>
          <Button
            type="link"
            size="small"
            icon={<CopyOutlined />}
            loading={activeTemplateId === record.id}
            onClick={() => void runAction(record.id, () => handleCopy(record.id))}
          >
            {isEnglish ? 'Copy' : '复制'}
          </Button>
          {!record.isDefault && (
            <Popconfirm
              title={isEnglish ? 'Delete this template?' : '确认删除这个模板吗？'}
              okText={isEnglish ? 'Delete' : '删除'}
              cancelText={isEnglish ? 'Cancel' : '取消'}
              onConfirm={() => void runAction(record.id, () => handleDelete(record.id))}
            >
              <Button
                type="link"
                danger
                size="small"
                icon={<DeleteOutlined />}
                loading={activeTemplateId === record.id}
              >
                {isEnglish ? 'Delete' : '删除'}
              </Button>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div data-testid="page-templates">
      <Card
        variant="borderless"
        title={<span style={{ fontSize: 20 }}>{isEnglish ? 'My Templates' : '我的模板'}</span>}
        extra={(
          <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/rules')}>
            {isEnglish ? 'New Template' : '新建模板'}
          </Button>
        )}
      >
        <Paragraph type="secondary" style={{ marginTop: -4 }}>
          {isEnglish
            ? 'Manage your own templates here. New templates are private by default, and you can publish any of them to the public gallery at any time.'
            : '这里管理你自己的模板。新建模板默认私有，你可以随时把其中任意模板公开到模板广场。'}
        </Paragraph>

        <Table
          data-testid="templates-table"
          columns={columns}
          dataSource={templates}
          rowKey="id"
          loading={loading}
          pagination={false}
        />
      </Card>
    </div>
  );
};

export default TemplatesManage;
